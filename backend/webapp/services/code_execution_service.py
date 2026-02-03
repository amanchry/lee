"""
Code execution business logic
"""
import os
import re
import subprocess
import tempfile
from typing import Dict, List, Optional, Tuple
from django.utils.timezone import now
from ..models import User


class CodeExecutionService:
    """Service for executing Python code safely"""
    
    EXECUTION_TIMEOUT = 30  # seconds
    
    DANGEROUS_PATTERNS = [
        (r'\bos\.system\s*\(', 'os.system()'),
        (r'\bsubprocess\s*\.', 'subprocess module'),
        (r'__import__\s*\(', '__import__()'),
        (r'\beval\s*\(', 'eval()'),
        (r'\bexec\s*\(', 'exec()'),
        (r'\bcompile\s*\(', 'compile()'),
        (r'\binput\s*\(', 'input()'),
        (r'\braw_input\s*\(', 'raw_input()'),
        (r'(?<!\.)\bfile\s*\(', 'file()'),
    ]
    
    @staticmethod
    def validate_code(code: str) -> Tuple[bool, Optional[str]]:
        """
        Validate code for security
        
        Returns:
            Tuple of (is_valid, error_message)
        """
        if not code or not code.strip():
            return False, "No code provided."
        
        code_lower = code.lower()
        for pattern, description in CodeExecutionService.DANGEROUS_PATTERNS:
            if re.search(pattern, code_lower):
                return False, f"Code contains restricted operation: {description}"
        
        return True, None
    
    @staticmethod
    def prepare_environment(user: User) -> Dict[str, str]:
        """Prepare environment variables for code execution"""
        from ..services.file_service import FileService
        
        user_media_dir = FileService.get_user_media_dir(user)
        user_assets_dir = os.path.join(user_media_dir, "assets")
        
        env = os.environ.copy()
        env['USER_MEDIA_DIR'] = user_media_dir
        env['USER_ASSETS_DIR'] = user_assets_dir
        env['USER_ID'] = str(user.id)
        env['USERNAME'] = user.username  # Add username for path resolution
        
        # Set Django settings module for subprocess
        if 'DJANGO_SETTINGS_MODULE' not in env:
            env['DJANGO_SETTINGS_MODULE'] = 'backend.settings'
        
        return env
    
    @staticmethod
    def get_code_preamble() -> str:
        """
        Get code preamble to inject before user code
        Provides helper functions for file path resolution
        """
        return """
import os
import sys

# Helper function to resolve user file paths
def get_user_path(relative_path):
    '''
    Resolve a relative path to absolute path. Supports both username and user_id formats.
    
    Examples:
        get_user_path('username_earthcode/assets/file.geojson')
        get_user_path('user_1/assets/file.geojson')
        get_user_path('assets/file.geojson')
    
    Args:
        relative_path: Path relative to user directory (can include username/user_X prefix or not)
    
    Returns:
        Absolute file path
    '''
    user_media_dir = os.getenv('USER_MEDIA_DIR')
    if not user_media_dir:
        raise ValueError("USER_MEDIA_DIR environment variable not set")
    
    # Remove username or 'user_X/' prefix if present
    username = os.getenv('USERNAME', '')
    if username and relative_path.startswith(username + '/'):
        relative_path = relative_path[len(username) + 1:]
    elif relative_path.startswith('user_'):
        # Handle user_X format for backward compatibility
        parts = relative_path.split('/', 1)
        if len(parts) > 1:
            relative_path = parts[1]
    
    return os.path.join(user_media_dir, relative_path)

def get_assets_path(relative_path):
    '''
    Resolve a relative path within assets folder.
    
    Examples:
        get_assets_path('file.geojson')
        get_assets_path('folder/file.geojson')
        get_assets_path('username_earthcode/assets/file.geojson')  # Also works
    
    Args:
        relative_path: Path relative to assets folder (e.g., 'file.geojson' or 'folder/file.geojson')
                      Can also include username prefix for convenience
    
    Returns:
        Absolute file path
    '''
    user_assets_dir = os.getenv('USER_ASSETS_DIR')
    if not user_assets_dir:
        raise ValueError("USER_ASSETS_DIR environment variable not set")
    
    # If path includes username or user_X prefix, extract assets part
    username = os.getenv('USERNAME', '')
    if username and relative_path.startswith(username + '/assets/'):
        relative_path = relative_path[len(username) + 8:]  # Remove 'username/assets/'
    elif relative_path.startswith('user_') and '/assets/' in relative_path:
        # Handle user_X/assets/ format
        parts = relative_path.split('/assets/', 1)
        if len(parts) > 1:
            relative_path = parts[1]
    
    return os.path.join(user_assets_dir, relative_path)

def get_area_by_name(area_name):
    '''
    Get an Area object from PostGIS by name.
    
    Args:
        area_name: Name of the area (case-insensitive)
    
    Returns:
        Area object with 'geom' attribute containing the geometry
    '''
    import os as os_module
    import sys
    import django
    
    # Setup Django if not already done
    if not hasattr(django, 'apps') or not django.apps.apps.ready:
        # Try to find Django settings module
        django_settings = os_module.getenv('DJANGO_SETTINGS_MODULE', 'backend.settings')
        os_module.environ.setdefault('DJANGO_SETTINGS_MODULE', django_settings)
        django.setup()
    
    from webapp.models import Area
    from django.contrib.auth import get_user_model
    
    User = get_user_model()
    user_id = os_module.getenv('USER_ID')
    if not user_id:
        raise ValueError("USER_ID environment variable not set")
    
    try:
        user = User.objects.get(id=int(user_id))
        area = Area.objects.get(user=user, name__iexact=area_name)
        return area
    except Area.DoesNotExist:
        raise ValueError(f"Area '{area_name}' not found")
    except Exception as e:
        raise ValueError(f"Error fetching area: {str(e)}")

def get_area_by_id(area_id):
    '''
    Get an Area object from PostGIS by ID.
    
    Args:
        area_id: ID of the area
    
    Returns:
        Area object with 'geom' attribute containing the geometry
    '''
    import os as os_module
    import sys
    import django
    
    # Setup Django if not already done
    if not hasattr(django, 'apps') or not django.apps.apps.ready:
        # Try to find Django settings module
        django_settings = os_module.getenv('DJANGO_SETTINGS_MODULE', 'backend.settings')
        os_module.environ.setdefault('DJANGO_SETTINGS_MODULE', django_settings)
        django.setup()
    
    from webapp.models import Area
    from django.contrib.auth import get_user_model
    
    User = get_user_model()
    user_id = os_module.getenv('USER_ID')
    if not user_id:
        raise ValueError("USER_ID environment variable not set")
    
    try:
        user = User.objects.get(id=int(user_id))
        area = Area.objects.get(id=int(area_id), user=user)
        return area
    except Area.DoesNotExist:
        raise ValueError(f"Area with ID {area_id} not found")
    except Exception as e:
        raise ValueError(f"Error fetching area: {str(e)}")

"""
    
    @staticmethod
    def execute_code(user: User, code: str) -> Tuple[Optional[Dict], Optional[str]]:
        """
        Execute Python code safely
        
        Returns:
            Tuple of (result_dict, error_message)
        """
        # Validate code
        is_valid, error = CodeExecutionService.validate_code(code)
        if not is_valid:
            return None, error
        
        # Create temporary file
        temp_file_path = None
        try:
            with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as temp_file:
                # Inject helper functions preamble
                preamble = CodeExecutionService.get_code_preamble()
                temp_file.write(preamble)
                temp_file.write('\n')
                temp_file.write('# User code starts here\n')
                temp_file.write(code)
                temp_file_path = temp_file.name
            
            # Prepare environment
            env = CodeExecutionService.prepare_environment(user)
            
            # Execute code
            result = subprocess.run(
                ['python3', temp_file_path],
                capture_output=True,
                text=True,
                timeout=CodeExecutionService.EXECUTION_TIMEOUT,
                cwd=tempfile.gettempdir(),
                env=env
            )
            
            # Format output
            output_logs = CodeExecutionService._format_output(result)
            
            return {
                "output": output_logs,
                "exit_code": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr
            }, None
            
        except subprocess.TimeoutExpired:
            return None, "Code execution timed out (30 seconds limit)."
        except Exception as e:
            return None, f"Error executing code: {str(e)}"
        finally:
            # Clean up temp file
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.unlink(temp_file_path)
                except:
                    pass
    
    @staticmethod
    def _format_output(result: subprocess.CompletedProcess) -> List[Dict]:
        """Format subprocess output into log entries"""
        output_logs = []
        current_timestamp = now().isoformat()
        
        # Add stdout lines
        stdout_lines = result.stdout.split('\n') if result.stdout else []
        for line in stdout_lines:
            if line.strip():
                output_logs.append({
                    "type": "log",
                    "message": line,
                    "timestamp": current_timestamp
                })
        
        # Add stderr lines, distinguishing between warnings and errors
        stderr_lines = result.stderr.split('\n') if result.stderr else []
        has_errors = False
        has_warnings = False
        
        for line in stderr_lines:
            if line.strip():
                line_lower = line.lower()
                # Check if it's a real error vs a warning
                is_error = False
                is_warning = False
                
                # GDAL errors (ERROR 1:, ERROR 2:, etc.)
                if re.search(r'error\s+\d+:', line_lower):
                    is_error = True
                    has_errors = True
                # Python tracebacks and exceptions
                elif 'traceback' in line_lower or 'exception:' in line_lower:
                    is_error = True
                    has_errors = True
                # GDAL FutureWarning (can be ignored or shown as warning)
                elif 'futurewarning' in line_lower or 'warnings.warn' in line_lower:
                    is_warning = True
                    has_warnings = True
                # Other error indicators
                elif 'cannot open' in line_lower or 'failed' in line_lower:
                    is_error = True
                    has_errors = True
                else:
                    # Default to warning for other stderr output
                    is_warning = True
                    has_warnings = True
                
                # Only show warnings if they're not the GDAL FutureWarning (we suppress that)
                if is_error:
                    output_logs.append({
                        "type": "error",
                        "message": line,
                        "timestamp": current_timestamp
                    })
                elif is_warning and 'futurewarning' not in line_lower and 'gdal' not in line_lower:
                    # Show other warnings but suppress GDAL FutureWarning
                    output_logs.append({
                        "type": "warning",
                        "message": line,
                        "timestamp": current_timestamp
                    })
        
        # Add execution status - only show success if no errors
        if result.returncode == 0 and not has_errors:
            output_logs.append({
                "type": "success",
                "message": f"Script executed successfully (exit code: {result.returncode})",
                "timestamp": current_timestamp
            })
        elif result.returncode == 0 and has_errors:
            # Don't show success message if there are errors, even if exit code is 0
            output_logs.append({
                "type": "error",
                "message": f"Script completed with errors (exit code: {result.returncode})",
                "timestamp": current_timestamp
            })
        else:
            output_logs.append({
                "type": "error",
                "message": f"Script execution failed (exit code: {result.returncode})",
                "timestamp": current_timestamp
            })
        
        return output_logs
