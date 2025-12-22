from typing import Dict
from ..utils.logger import logger


class SummaryReporter:
    """Generate summary report for conversion"""

    def generate(self, conversion_results: Dict) -> Dict:
        """
        Generate comprehensive conversion report

        Args:
            conversion_results: Dictionary containing all conversion results

        Returns:
            Summary report dictionary
        """
        logger.info("Generating conversion summary report")

        # Extract results from each converter
        analysis = conversion_results.get('analysis', {})
        models = conversion_results.get('models', {})
        views = conversion_results.get('views', {})
        urls = conversion_results.get('urls', {})
        templates = conversion_results.get('templates', {})
        verification = conversion_results.get('verification', {})

        # Calculate overall accuracy
        accuracy_score = self._calculate_accuracy(models, views, urls, templates)

        # Compile all issues
        all_issues = []
        all_issues.extend(models.get('issues', []))
        all_issues.extend(views.get('issues', []))
        all_issues.extend(urls.get('issues', []))
        all_issues.extend(templates.get('issues', []))

        # Compile all warnings
        all_warnings = []
        all_warnings.extend(models.get('warnings', []))
        all_warnings.extend(views.get('warnings', []))
        all_warnings.extend(urls.get('warnings', []))
        all_warnings.extend(templates.get('warnings', []))

        # Generate summary
        report = {
            'success': True,
            'accuracy_score': accuracy_score,
            'total_files_converted': (
                len(models.get('converted_files', [])) +
                len(views.get('converted_files', [])) +
                len(urls.get('converted_files', [])) +
                len(templates.get('converted_files', []))
            ),
            'models_converted': models.get('total_models', 0),
            'views_converted': views.get('total_views', 0),
            'urls_converted': urls.get('total_patterns', 0),
            'templates_converted': templates.get('total_templates', 0),
            'issues': all_issues,
            'warnings': all_warnings,
            'suggestions': self._generate_suggestions(analysis, models, views, urls),
            'gemini_verification': verification,
            'summary': self._generate_summary_text(analysis, accuracy_score),
            'next_steps': self._generate_next_steps(all_issues, all_warnings)
        }

        logger.info(f"Report generated with accuracy score: {accuracy_score}%")

        return report

    def _calculate_accuracy(self, models: Dict, views: Dict, urls: Dict, templates: Dict) -> float:
        """Calculate overall conversion accuracy score"""

        total_items = (
            models.get('total_models', 0) +
            views.get('total_views', 0) +
            urls.get('total_patterns', 0) +
            templates.get('total_templates', 0)
        )

        if total_items == 0:
            return 0.0

        total_issues = (
            len(models.get('issues', [])) +
            len(views.get('issues', [])) +
            len(urls.get('issues', [])) +
            len(templates.get('issues', []))
        )

        # Simple accuracy calculation
        # Can be made more sophisticated based on issue severity
        success_rate = ((total_items - total_issues) / total_items) * 100

        return round(min(success_rate, 100.0), 2)

    def _generate_summary_text(self, analysis: Dict, accuracy_score: float) -> str:
        """Generate human-readable summary"""

        apps_count = len(analysis.get('apps', []))
        django_version = analysis.get('django_version', 'Unknown')

        summary = f"""
Django to Flask Conversion Summary
=====================================

Project Analysis:
- Django Version: {django_version}
- Number of Apps: {apps_count}

Conversion Accuracy: {accuracy_score}%

The conversion process has been completed. Please review the generated Flask
application and address any warnings or issues before deployment.

Key areas requiring manual review:
1. Database relationships (ForeignKey, ManyToMany)
2. Custom template tags and filters
3. Django-specific middleware
4. Authentication and permissions
5. Form validation

All converted files maintain the original structure for easy comparison.
        """

        return summary.strip()

    def _generate_suggestions(self, analysis: Dict, models: Dict, views: Dict, urls: Dict) -> list:
        """Generate suggestions for improvement"""

        suggestions = []

        # Models suggestions
        if models.get('total_models', 0) > 0:
            suggestions.append({
                'category': 'models',
                'message': 'Install Flask-SQLAlchemy and initialize db instance in your Flask app',
                'code': 'pip install flask-sqlalchemy'
            })

        # Views suggestions
        if views.get('total_views', 0) > 0:
            suggestions.append({
                'category': 'views',
                'message': 'Add route decorators to converted view functions',
                'code': '@app.route("/path") or @bp.route("/path")'
            })

        # URLs suggestions
        if urls.get('total_patterns', 0) > 0:
            suggestions.append({
                'category': 'urls',
                'message': 'Integrate converted routes with Flask blueprints',
                'code': 'app.register_blueprint(bp)'
            })

        # Authentication suggestion
        suggestions.append({
            'category': 'authentication',
            'message': 'Install Flask-Login for user authentication',
            'code': 'pip install flask-login'
        })

        return suggestions

    def _generate_next_steps(self, issues: list, warnings: list) -> list:
        """Generate next steps for the developer"""

        steps = []

        steps.append("1. Review all converted files for accuracy")
        steps.append("2. Install required Flask dependencies (see suggestions)")
        steps.append("3. Initialize Flask app and database")
        steps.append("4. Register blueprints for each converted app")

        if issues:
            steps.append(f"5. Fix {len(issues)} conversion issues")

        if warnings:
            steps.append(f"6. Address {len(warnings)} warnings")

        steps.append("7. Run tests to verify functionality")
        steps.append("8. Update requirements.txt with Flask dependencies")

        return steps


__all__ = ['SummaryReporter']
