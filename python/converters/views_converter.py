import json
from pathlib import Path
from typing import Dict
from ..utils.file_handler import FileHandler
from ..utils.logger import logger


class ViewsConverter:
    """Convert Django views to Flask routes"""

    def __init__(self, django_path: str, output_path: str):
        self.django_path = Path(django_path)
        self.output_path = Path(output_path)
        self.rules = self._load_rules()
        self.results = {
            'converted_files': [],
            'total_views': 0,
            'issues': [],
            'warnings': []
        }

    def _load_rules(self) -> Dict:
        """Load conversion rules from JSON"""
        rules_path = Path(__file__).parent.parent / 'rules' / 'views_rules.json'
        with open(rules_path, 'r') as f:
            return json.load(f)

    def convert(self) -> Dict:
        """Convert all Django views to Flask"""
        logger.info("Starting views conversion")

        view_files = FileHandler.find_files(str(self.django_path), 'views.py')
        view_files = [f for f in view_files if '__pycache__' not in str(f)]

        for view_file in view_files:
            try:
                result = self._convert_file(view_file)
                self.results['converted_files'].append(result)
                self.results['total_views'] += result.get('views_count', 0)
            except Exception as e:
                logger.error(f"Failed to convert {view_file}: {e}")
                self.results['issues'].append({
                    'file': str(view_file),
                    'error': str(e)
                })

        logger.info(f"Views conversion complete. Converted {self.results['total_views']} views")
        return self.results

    def _convert_file(self, file_path: Path) -> Dict:
        """Convert a single Django views file"""
        logger.info(f"Converting views file: {file_path}")

        source_code = FileHandler.read_file(str(file_path))
        converted_code = self._convert_views_code(source_code)

        # Calculate output path
        relative_path = file_path.relative_to(self.django_path)
        output_file = self.output_path / relative_path

        # Write converted code
        FileHandler.write_file(str(output_file), converted_code)

        return {
            'file': str(file_path),
            'output': str(output_file),
            'success': True,
            'views_count': converted_code.count('def ') - converted_code.count('def __')
        }

    def _convert_views_code(self, code: str) -> str:
        """Convert Django views code to Flask"""

        converted = code

        # Convert imports
        converted = converted.replace(
            'from django.shortcuts import render',
            'from flask import render_template'
        )
        converted = converted.replace(
            'from django.http import HttpResponse',
            'from flask import Response'
        )
        converted = converted.replace(
            'from django.http import JsonResponse',
            'from flask import jsonify'
        )
        converted = converted.replace(
            'from django.shortcuts import redirect',
            'from flask import redirect, url_for'
        )
        converted = converted.replace(
            'from django.contrib.auth.decorators import login_required',
            'from flask_login import login_required'
        )

        # Convert render() to render_template()
        converted = converted.replace('render(request, ', 'render_template(')

        # Convert JsonResponse to jsonify
        converted = converted.replace('JsonResponse(', 'jsonify(')

        # Convert HttpResponse to return string
        converted = converted.replace('HttpResponse(', '# Return ')

        # Convert request.GET to request.args
        converted = converted.replace('request.GET', 'request.args')

        # Convert request.POST to request.form
        converted = converted.replace('request.POST', 'request.form')

        # Convert request.user to current_user
        converted = converted.replace('request.user', 'current_user')

        # Add Flask app import at the top if not present
        if 'from flask import' in converted and 'app' not in converted[:200]:
            converted = 'from flask import current_app as app\n' + converted

        # Add warning comment
        converted = '# WARNING: This is an automated conversion from Django to Flask\n' + \
                    '# Please review and test thoroughly before using in production\n' + \
                    '# Routes need to be added using @app.route() or @bp.route() decorators\n\n' + \
                    converted

        self.results['warnings'].append({
            'type': 'manual_routes',
            'message': 'Views converted but routes must be added manually or via urls_converter'
        })

        return converted


__all__ = ['ViewsConverter']
