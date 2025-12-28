#!/usr/bin/env python3
"""
FrameShift Python Conversion Engine
Main entry point for Django-to-Flask conversion
"""

import sys
import json
import argparse
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from python.analyzers.django_analyzer import DjangoAnalyzer
from python.analyzers.framework_detector import FrameworkDetector
from python.converters.models_converter import ModelsConverter
from python.converters.views_converter import ViewsConverter
from python.converters.urls_converter import URLsConverter
from python.converters.templates_converter import TemplatesConverter
from python.report_generators.summary_reporter import SummaryReporter
from python.services.gemini_verifier import GeminiVerifier
from python.utils.progress_emitter import ProgressEmitter
from python.utils.logger import logger


def emit_progress(job_id, step, progress, message):
    """Emit progress update to Node.js"""
    ProgressEmitter.emit(job_id, step, progress, message)


def main():
    """Main conversion function"""
    parser = argparse.ArgumentParser(description='Convert Django project to Flask')
    parser.add_argument('--job-id', required=True, help='Conversion job ID')
    parser.add_argument('--project-path', required=True, help='Path to Django project')
    parser.add_argument('--output-path', required=True, help='Output path for Flask project')
    parser.add_argument('--gemini-api-key', help='Google Gemini API key for verification')

    args = parser.parse_args()

    try:
        logger.info(f"Starting conversion for job {args.job_id}")
        logger.info(f"Django project: {args.project_path}")
        logger.info(f"Output path: {args.output_path}")

        # Step 0: Framework Detection (5%)
        emit_progress(args.job_id, 'detecting_framework', 5, 'Detecting project framework')
        detector = FrameworkDetector(args.project_path)
        framework_result = detector.detect()
        logger.info(f"Detected framework: {framework_result['framework']} (confidence: {framework_result['confidence']})")

        # Check if framework is supported
        if not framework_result['is_supported']:
            error_msg = f"Unsupported framework: {framework_result['framework']}. Only Django projects are currently supported."
            logger.error(error_msg)
            raise ValueError(error_msg)

        # Step 1: Analyze Django project (10%)
        emit_progress(args.job_id, 'analyzing', 10, 'Analyzing Django project structure')
        analyzer = DjangoAnalyzer(args.project_path)
        analysis_result = analyzer.analyze()
        analysis_result['framework_detection'] = framework_result
        logger.info(f"Analysis complete: Found {len(analysis_result.get('apps', []))} Django apps")

        # Step 2: Convert Models (30%)
        emit_progress(args.job_id, 'converting_models', 30, 'Converting Django models to SQLAlchemy')
        models_converter = ModelsConverter(args.project_path, args.output_path)
        models_result = models_converter.convert()
        logger.info(f"Models conversion complete: {models_result.get('total_models', 0)} models converted")

        # Step 3: Convert Views (50%)
        emit_progress(args.job_id, 'converting_views', 50, 'Converting Django views to Flask routes')
        views_converter = ViewsConverter(args.project_path, args.output_path)
        views_result = views_converter.convert()
        logger.info(f"Views conversion complete: {views_result.get('total_views', 0)} views converted")

        # Step 4: Convert URLs (65%)
        emit_progress(args.job_id, 'converting_urls', 65, 'Converting URL patterns to Flask routes')
        urls_converter = URLsConverter(args.project_path, args.output_path)
        urls_result = urls_converter.convert()
        logger.info(f"URLs conversion complete: {urls_result.get('total_patterns', 0)} patterns converted")

        # Step 5: Convert Templates (80%)
        emit_progress(args.job_id, 'converting_templates', 80, 'Converting Django templates to Jinja2')
        templates_converter = TemplatesConverter(args.project_path, args.output_path)
        templates_result = templates_converter.convert()
        logger.info(f"Templates conversion complete: {templates_result.get('total_templates', 0)} templates converted")

        # Step 6: AI Verification (90%)
        emit_progress(args.job_id, 'verifying', 90, 'Verifying conversion with AI')
        gemini_verifier = GeminiVerifier(args.gemini_api_key)

        verification_result = {
            'enabled': gemini_verifier.enabled,
            'models_verification': {'enabled': False},
            'views_verification': {'enabled': False},
            'ai_summary': {}
        }

        # Generate AI summary if Gemini is enabled
        if gemini_verifier.enabled:
            logger.info("Running Gemini AI verification")
            ai_summary = gemini_verifier.generate_summary({
                'models': models_result,
                'views': views_result,
                'urls': urls_result,
                'templates': templates_result
            })
            verification_result['ai_summary'] = ai_summary
            logger.info(f"AI Summary generated: Overall quality {ai_summary.get('overall_quality', 0)}%")
        else:
            logger.info("AI verification disabled (Gemini API key not provided or package not installed)")

        # Step 7: Generate Report (95%)
        emit_progress(args.job_id, 'generating_report', 95, 'Generating conversion report')
        reporter = SummaryReporter()
        report = reporter.generate({
            'analysis': analysis_result,
            'models': models_result,
            'views': views_result,
            'urls': urls_result,
            'templates': templates_result,
            'verification': verification_result
        })
        logger.info(f"Report generated with accuracy score: {report['accuracy_score']}%")

        # Step 8: Complete (100%)
        emit_progress(args.job_id, 'completed', 100, 'Conversion completed successfully')

        # Send final result to Node.js
        result = {
            'success': True,
            'report': report,
            'output_path': args.output_path
        }
        ProgressEmitter.emit_result(result)

        logger.info(f"Conversion completed successfully for job {args.job_id}")
        sys.exit(0)

    except Exception as e:
        logger.error(f"Conversion failed: {str(e)}", exc_info=True)
        ProgressEmitter.emit_error(args.job_id, str(e))
        sys.exit(1)


if __name__ == '__main__':
    main()
