import ast
import json
from pathlib import Path
from typing import Dict, List
from ..utils.file_handler import FileHandler
from ..utils.logger import logger


class ModelsConverter:
    """Convert Django models to SQLAlchemy models"""

    def __init__(self, django_path: str, output_path: str):
        self.django_path = Path(django_path)
        self.output_path = Path(output_path)
        self.rules = self._load_rules()
        self.results = {
            'converted_files': [],
            'total_models': 0,
            'total_fields': 0,
            'issues': [],
            'warnings': []
        }

    def _load_rules(self) -> Dict:
        """Load conversion rules from JSON"""
        rules_path = Path(__file__).parent.parent / 'rules' / 'models_rules.json'
        with open(rules_path, 'r') as f:
            return json.load(f)

    def convert(self) -> Dict:
        """
        Convert all Django models to SQLAlchemy

        Returns:
            Dictionary with conversion results
        """
        logger.info("Starting models conversion")

        # Find all models.py files
        model_files = FileHandler.find_files(str(self.django_path), 'models.py')
        model_files = [f for f in model_files if '__pycache__' not in str(f)]

        for model_file in model_files:
            try:
                result = self._convert_file(model_file)
                self.results['converted_files'].append(result)
                self.results['total_models'] += result.get('models_count', 0)
            except Exception as e:
                logger.error(f"Failed to convert {model_file}: {e}")
                self.results['issues'].append({
                    'file': str(model_file),
                    'error': str(e)
                })

        logger.info(f"Models conversion complete. Converted {self.results['total_models']} models")
        return self.results

    def _convert_file(self, file_path: Path) -> Dict:
        """Convert a single Django models file"""
        logger.info(f"Converting models file: {file_path}")

        source_code = FileHandler.read_file(str(file_path))

        # Parse AST
        try:
            tree = ast.parse(source_code)
        except SyntaxError as e:
            logger.error(f"Syntax error in {file_path}: {e}")
            return {
                'file': str(file_path),
                'success': False,
                'error': str(e)
            }

        # Convert the code
        converted_code = self._convert_models_ast(tree, source_code)

        # Calculate output path
        relative_path = file_path.relative_to(self.django_path)
        output_file = self.output_path / relative_path

        # Write converted code
        FileHandler.write_file(str(output_file), converted_code)

        return {
            'file': str(file_path),
            'output': str(output_file),
            'success': True,
            'models_count': converted_code.count('class ') - converted_code.count('class Meta')
        }

    def _convert_models_ast(self, tree: ast.AST, original_code: str) -> str:
        """Convert Django models AST to Flask-SQLAlchemy code"""

        # Simple approach: String replacement with pattern matching
        # For production, you'd want full AST transformation

        converted = original_code

        # Replace imports
        converted = converted.replace(
            'from django.db import models',
            'from flask_sqlalchemy import SQLAlchemy\n\ndb = SQLAlchemy()'
        )
        converted = converted.replace('import models', '')

        # Replace model inheritance
        converted = converted.replace('(models.Model)', '(db.Model)')

        # Convert field types
        field_mappings = self.rules['field_mappings']

        for django_field, mapping in field_mappings.items():
            if 'flask' in mapping:
                # Simple field conversions
                pattern = f'models.{django_field}('

                if django_field in ['CharField', 'SlugField']:
                    # Handle max_length parameter
                    converted = self._convert_field_with_max_length(converted, django_field)
                elif django_field in ['ForeignKey', 'OneToOneField']:
                    # Handle relationships
                    self.results['warnings'].append({
                        'type': 'relationship',
                        'message': f'{django_field} requires manual review for proper conversion'
                    })
                else:
                    # Simple replacement
                    flask_field = mapping['flask'].replace('{', '{{').replace('}', '}}')
                    converted = converted.replace(pattern, flask_field.replace('{{', '{').replace('}}', '}') + '(')

        # Convert Meta class
        converted = self._convert_meta_class(converted)

        # Add db instance initialization comment
        if 'db.Model' in converted and 'db = SQLAlchemy()' in converted:
            converted = '# Initialize db instance in your Flask app:\n# db.init_app(app)\n\n' + converted

        return converted

    def _convert_field_with_max_length(self, code: str, field_name: str) -> str:
        """Convert CharField/SlugField with max_length parameter"""
        import re

        pattern = rf'models\.{field_name}\(max_length=(\d+)'
        matches = re.finditer(pattern, code)

        for match in reversed(list(matches)):
            max_length = match.group(1)
            start, end = match.span()

            # Find the closing parenthesis
            depth = 1
            i = end
            while i < len(code) and depth > 0:
                if code[i] == '(':
                    depth += 1
                elif code[i] == ')':
                    depth -= 1
                i += 1

            old_field = code[start:i]
            new_field = f'db.Column(db.String({max_length}))'
            code = code[:start] + new_field + code[i:]

        return code

    def _convert_meta_class(self, code: str) -> str:
        """Convert Django Meta class to SQLAlchemy table args"""

        if 'class Meta:' in code:
            self.results['warnings'].append({
                'type': 'meta_class',
                'message': 'Meta class found - requires manual conversion to __tablename__ and __table_args__'
            })

        # Simple conversion for db_table
        code = code.replace(
            "db_table = '",
            "__tablename__ = '"
        )

        return code


__all__ = ['ModelsConverter']
