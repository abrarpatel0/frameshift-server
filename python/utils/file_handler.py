import os
import shutil
from pathlib import Path
from typing import List, Dict


class FileHandler:
    """Utility class for file operations"""

    @staticmethod
    def find_files(directory: str, pattern: str) -> List[Path]:
        """
        Find files matching pattern in directory

        Args:
            directory: Directory to search
            pattern: File pattern (e.g., '*.py', 'models.py')

        Returns:
            List of matching file paths
        """
        path = Path(directory)
        if '*' in pattern:
            return list(path.rglob(pattern))
        else:
            return list(path.rglob(pattern))

    @staticmethod
    def read_file(file_path: str) -> str:
        """
        Read file contents

        Args:
            file_path: Path to file

        Returns:
            File contents as string
        """
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()

    @staticmethod
    def write_file(file_path: str, content: str):
        """
        Write content to file

        Args:
            file_path: Path to file
            content: Content to write
        """
        # Ensure directory exists
        Path(file_path).parent.mkdir(parents=True, exist_ok=True)

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)

    @staticmethod
    def copy_file(src: str, dst: str):
        """
        Copy file from source to destination

        Args:
            src: Source file path
            dst: Destination file path
        """
        Path(dst).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)

    @staticmethod
    def get_relative_path(file_path: str, base_path: str) -> str:
        """
        Get relative path from base path

        Args:
            file_path: Full file path
            base_path: Base directory path

        Returns:
            Relative path
        """
        return os.path.relpath(file_path, base_path)

    @staticmethod
    def ensure_directory(directory: str):
        """
        Ensure directory exists

        Args:
            directory: Directory path
        """
        Path(directory).mkdir(parents=True, exist_ok=True)


__all__ = ['FileHandler']
