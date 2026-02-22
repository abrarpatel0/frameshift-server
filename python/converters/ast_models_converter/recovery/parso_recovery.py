#!/usr/bin/env python3
"""
Phase 3: Parso-based Error Recovery
Handles broken/incomplete Django code with graceful fallbacks
"""

import parso
from typing import Dict, List, Optional
from pathlib import Path


class ParsoRecoveryAnalyzer:
    """Use Parso to analyze broken Django code and provide fallback conversions"""

    def __init__(self):
        self.recovery_applied = False
        self.errors_found = []

    def analyze_with_recovery(self, file_path: Path) -> Dict:
        """Analyze file with error recovery"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                code = f.read()

            # Parse with Parso (tolerates syntax errors)
            module = parso.parse(code)

            result = {
                'file_path': str(file_path),
                'models': [],
                'has_errors': len(module.errors) > 0,
                'errors': [self._format_error(err) for err in module.errors],
                'recovery_applied': False,
                'success': True
            }

            # Extract models even from broken code
            models = self._extract_models_from_tree(module)
            result['models'] = models

            if models:
                result['recovery_applied'] = True

            return result

        except Exception as e:
            return {
                'file_path': str(file_path),
                'models': [],
                'has_errors': True,
                'errors': [str(e)],
                'recovery_applied': False,
                'success': False
            }

    def _format_error(self, error) -> Dict:
        """Format Parso error object"""
        return {
            'message': error.message,
            'line': error.start_pos[0],
            'column': error.start_pos[1],
            'type': error.type
        }

    def _extract_models_from_tree(self, tree) -> List[Dict]:
        """Extract model information from Parso tree"""
        models = []

        # Traverse tree to find class definitions
        for node in self._walk_tree(tree):
            if node.type == 'classdef':
                model_info = self._analyze_class_node(node)
                if model_info and self._is_model_class(model_info):
                    models.append(model_info)

        return models

    def _walk_tree(self, node):
        """Walk Parso tree recursively"""
        yield node
        try:
            for child in node.children:
                yield from self._walk_tree(child)
        except AttributeError:
            pass

    def _analyze_class_node(self, class_node) -> Optional[Dict]:
        """Analyze a class definition node"""
        try:
            # Get class name
            class_name = None
            for child in class_node.children:
                if child.type == 'name':
                    class_name = child.value
                    break

            if not class_name:
                return None

            # Get base classes
            base_classes = self._extract_base_classes(class_node)

            # Get class body
            fields = self._extract_fields(class_node)

            return {
                'name': class_name,
                'base_classes': base_classes,
                'fields': fields,
                'source': class_node.get_code()
            }

        except Exception:
            return None

    def _is_model_class(self, class_info: Dict) -> bool:
        """Check if class is likely a Django model"""
        base_classes = class_info.get('base_classes', [])
        for base in base_classes:
            if 'Model' in base or 'AbstractUser' in base or 'AbstractBaseUser' in base:
                return True
        return False

    def _extract_base_classes(self, class_node) -> List[str]:
        """Extract base class names"""
        base_classes = []

        try:
            for child in class_node.children:
                if child.type == 'arglist':
                    # Parse argument list for base classes
                    for arg_child in child.children:
                        if arg_child.type == 'name':
                            base_classes.append(arg_child.value)
                        elif arg_child.type == 'trailer':
                            # Dotted name like models.Model
                            base_name = self._get_dotted_name(arg_child)
                            if base_name:
                                base_classes.append(base_name)
        except Exception:
            pass

        return base_classes

    def _get_dotted_name(self, node) -> str:
        """Get dotted name from node"""
        parts = []
        try:
            for child in self._walk_tree(node):
                if child.type == 'name':
                    parts.append(child.value)
        except Exception:
            pass
        return '.'.join(parts) if parts else ''

    def _extract_fields(self, class_node) -> List[Dict]:
        """Extract field definitions from class body"""
        fields = []

        try:
            # Find class body (suite)
            for child in class_node.children:
                if child.type == 'suite':
                    # Look for assignments in suite
                    for stmt in child.children:
                        field_info = self._analyze_statement(stmt)
                        if field_info:
                            fields.append(field_info)
        except Exception:
            pass

        return fields

    def _analyze_statement(self, stmt_node) -> Optional[Dict]:
        """Analyze a statement to extract field information"""
        try:
            # Look for assignment: field_name = FieldType(...)
            if stmt_node.type == 'simple_stmt':
                for child in stmt_node.children:
                    if child.type == 'expr_stmt':
                        field_info = self._parse_field_assignment(child)
                        if field_info:
                            return field_info
        except Exception:
            pass
        return None

    def _parse_field_assignment(self, expr_node) -> Optional[Dict]:
        """Parse field assignment expression"""
        try:
            # Get left side (field name)
            field_name = None
            field_type = None
            field_params = {}

            children_list = list(expr_node.children)

            # First child should be field name
            if children_list and children_list[0].type == 'name':
                field_name = children_list[0].value

            # Look for function call (field type)
            for child in children_list:
                if child.type == 'trailer' and self._is_function_call(child):
                    # Previous sibling should be field type
                    idx = children_list.index(child)
                    if idx > 0:
                        prev = children_list[idx - 1]
                        if prev.type == 'name':
                            field_type = prev.value

                    # Extract parameters from call
                    field_params = self._extract_call_params(child)

            if field_name and field_type:
                # Skip non-field attributes
                if field_name in ['objects', 'Meta'] or field_name.isupper():
                    return None

                return {
                    'name': field_name,
                    'type': field_type,
                    'params': field_params
                }

        except Exception:
            pass

        return None

    def _is_function_call(self, node) -> bool:
        """Check if node represents a function call"""
        try:
            for child in node.children:
                if child.type == 'arglist':
                    return True
        except Exception:
            pass
        return False

    def _extract_call_params(self, call_node) -> Dict:
        """Extract parameters from function call"""
        params = {}

        try:
            for child in call_node.children:
                if child.type == 'arglist':
                    # Parse arguments
                    for arg_child in child.children:
                        if arg_child.type == 'argument':
                            # Keyword argument: key=value
                            param_name, param_value = self._parse_argument(arg_child)
                            if param_name:
                                params[param_name] = param_value
        except Exception:
            pass

        return params

    def _parse_argument(self, arg_node) -> tuple:
        """Parse keyword argument"""
        try:
            children = list(arg_node.children)
            if len(children) >= 3:
                # Format: name = value
                param_name = children[0].value if children[0].type == 'name' else None
                param_value = self._get_node_value(children[2])
                return param_name, param_value
        except Exception:
            pass
        return None, None

    def _get_node_value(self, node):
        """Extract value from node"""
        try:
            if node.type == 'number':
                value = node.value
                return int(value) if '.' not in value else float(value)
            elif node.type == 'string':
                # Remove quotes
                return node.value.strip('"\'')
            elif node.type == 'name':
                value = node.value
                if value == 'True':
                    return True
                elif value == 'False':
                    return False
                return value
        except Exception:
            pass
        return node.get_code() if hasattr(node, 'get_code') else str(node)


def recover_models(file_path: Path) -> Dict:
    """Attempt to recover model information from broken code"""
    analyzer = ParsoRecoveryAnalyzer()
    return analyzer.analyze_with_recovery(file_path)


def create_fallback_model(model_name: str, table_name: str = None) -> str:
    """Create a basic fallback SQLAlchemy model"""
    if not table_name:
        table_name = model_name.lower()

    return f"""class {model_name}(db.Model):
    __tablename__ = '{table_name}'

    id = db.Column(db.Integer, primary_key=True)
    # TODO: Add fields manually - automatic conversion failed

    def __repr__(self):
        return f'<{model_name} {{self.id}}>'
"""
