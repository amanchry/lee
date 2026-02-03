"""
File management views - thin HTTP layer
"""
import json
import os
from django.views.decorators.csrf import csrf_exempt
from ..services.file_service import FileService
from ..utils.response_helpers import success_response, error_response, validation_error
from ..utils.auth_helpers import get_user_from_token


@csrf_exempt
def upload_user_file(request):
    """Upload file to user's directory"""
    if request.method != 'POST':
        return error_response("Invalid request method. Use POST.", status_code=405)
    
    user, error = get_user_from_token(request)
    if error:
        return error
    
    try:
        folder_path = request.POST.get('folder_path', 'assets')
        
        # Convert username-based path to relative path if needed
        if folder_path and folder_path.startswith(user.username + '/'):
            # Extract relative path after username
            folder_path = folder_path.replace(user.username + '/', '', 1)
        elif folder_path and folder_path.startswith(f'user_{user.id}/'):
            # Extract relative path after user_X
            folder_path = folder_path.replace(f'user_{user.id}/', '', 1)
        
        # Debug logging
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Upload request - User: {user.username}, Folder path: {folder_path}, POST keys: {list(request.POST.keys())}, FILES keys: {list(request.FILES.keys())}")
        
        if 'file' not in request.FILES:
            logger.error("No file in request.FILES")
            return validation_error("No file provided.")
        
        uploaded_file = request.FILES['file']
        logger.info(f"Uploading file: {uploaded_file.name}, size: {uploaded_file.size}")
        
        # Check file type - only allow geojson, geotiff, csv
        file_ext = os.path.splitext(uploaded_file.name)[1].lower()
        is_geojson = file_ext in ['.geojson', '.json']
        is_geotiff = file_ext in ['.tif', '.tiff', '.geotiff']
        is_csv = file_ext == '.csv'
        
        # Validate file type
        if not (is_geojson or is_geotiff or is_csv):
            return error_response(
                "Invalid file type. Only GeoJSON, GeoTIFF, and CSV files are allowed.",
                status_code=400
            )
        
        # Check if area_name is provided (for GeoJSON uploads to PostGIS)
        area_name = request.POST.get('area_name', '').strip()
        
        if is_geojson and area_name:
            # Save GeoJSON to PostGIS instead of file system
            try:
                # Read GeoJSON content
                geojson_content = uploaded_file.read().decode('utf-8')
                
                # Save to PostGIS
                area_data, error_msg = FileService.save_geojson_to_postgis(
                    user, geojson_content, area_name, folder_path
                )
                
                if error_msg:
                    logger.error(f"PostGIS save error: {error_msg}")
                    return error_response(error_msg, status_code=400)
                
                logger.info(f"GeoJSON saved to PostGIS: {area_data.get('name')}")
                return success_response(
                    data=area_data,
                    message="GeoJSON saved to PostGIS successfully.",
                    status_code=201
                )
            except UnicodeDecodeError:
                return error_response("Invalid file encoding. Please ensure the file is UTF-8 encoded.", status_code=400)
            except Exception as e:
                logger.exception(f"Exception saving GeoJSON to PostGIS: {str(e)}")
                return error_response(f"Error saving GeoJSON: {str(e)}", status_code=500)
        elif is_geojson and not area_name:
            # GeoJSON file but no area name - return error asking for name
            return error_response(
                "Area name is required for GeoJSON files. Please provide 'area_name' parameter.",
                status_code=400
            )
        else:
            # CSV or GeoTIFF files go to file system (not PostGIS)
            # Regular file upload (non-GeoJSON or GeoJSON without area_name)
            file_data, error_msg = FileService.upload_file(user, uploaded_file, folder_path)
            
            if error_msg:
                logger.error(f"FileService error: {error_msg}")
                return error_response(error_msg, status_code=400)
            
            # Convert returned path to username format for frontend
            if file_data and 'file_path' in file_data:
                original_path = file_data['file_path']
                username_path = original_path.replace(f'user_{user.id}', user.username) if original_path.startswith(f'user_{user.id}') else original_path
                file_data['file_path'] = username_path
                file_data['original_path'] = original_path  # Keep original for backend operations
            
            logger.info(f"File uploaded successfully: {file_data.get('file_path')}")
            return success_response(
                data=file_data,
                message="File uploaded successfully.",
                status_code=201
            )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.exception(f"Exception uploading file: {str(e)}")
        return error_response(f"Error uploading file: {str(e)}", status_code=500)


@csrf_exempt
def create_user_folder(request):
    """Create a new folder in user's directory"""
    if request.method != 'POST':
        return error_response("Invalid request method. Use POST.", status_code=405)
    
    user, error = get_user_from_token(request)
    if error:
        return error
    
    try:
        data = json.loads(request.body)
        folder_name = data.get("folder_name", "").strip()
        parent_path = data.get("parent_path", "").strip()
        
        # Convert username-based path to user_X format if needed
        if parent_path and parent_path.startswith(user.username + '/'):
            parent_path = parent_path.replace(user.username, f'user_{user.id}', 1)
        elif parent_path == 'assets':
            # Keep as is - this is handled by validate_folder_path
            pass
        
        folder_data, error_msg = FileService.create_folder(user, folder_name, parent_path)
        
        if error_msg:
            return error_response(error_msg, status_code=400)
        
        # Convert returned path to username format for frontend
        if folder_data and 'folder_path' in folder_data:
            original_path = folder_data['folder_path']
            username_path = original_path.replace(f'user_{user.id}', user.username) if original_path.startswith(f'user_{user.id}') else original_path
            folder_data['folder_path'] = username_path
            folder_data['original_path'] = original_path  # Keep original for backend operations
        
        return success_response(
            data=folder_data,
            message="Folder created successfully.",
            status_code=201
        )
    except json.JSONDecodeError:
        return validation_error("Invalid JSON data.")
    except Exception as e:
        return error_response(f"Error creating folder: {str(e)}", status_code=500)


@csrf_exempt
def list_user_files(request):
    """List files and folders in user's directory"""
    if request.method != 'GET':
        return error_response("Invalid request method. Use GET.", status_code=405)
    
    user, error = get_user_from_token(request)
    if error:
        return error
    
    try:
        folder_path = request.GET.get('folder_path', 'assets')
        files_list, error_msg = FileService.list_files(user, folder_path)
        
        if error_msg:
            return error_response(error_msg, status_code=400)
        
        # Separate files and folders and convert paths to username-based format
        files = []
        folders = []
        username = user.username
        
        for item in (files_list or []):
            # Convert path from user_X/... to username/... format
            original_path = item.get('path', '')
            username_path = original_path.replace(f'user_{user.id}', username) if original_path.startswith(f'user_{user.id}') else original_path
            
            if item.get('type') == 'folder':
                folders.append({
                    'name': item.get('name'),
                    'path': username_path,
                    'original_path': original_path  # Keep original for backend operations
                })
            else:
                # Extract file extension
                file_name = item.get('name', '')
                file_ext = file_name.split('.')[-1].lower() if '.' in file_name else ''
                
                files.append({
                    'name': item.get('name'),
                    'path': username_path,
                    'original_path': original_path,  # Keep original for backend operations
                    'size': item.get('size', 0),
                    'extension': file_ext,
                    'url': item.get('url', ''),
                    'metadata': item.get('metadata', {}),  # Include metadata with bounds/extent
                    'is_geojson_in_postgis': item.get('is_geojson_in_postgis', False),
                    'postgis_area_id': item.get('postgis_area_id'),
                    'asset_type': item.get('asset_type', 'other')
                })
        
        return success_response(data={
            'files': files,
            'folders': folders,
            'current_path': folder_path,
            'username': username  # Include username for frontend use
        })
    except Exception as e:
        return error_response(f"Error listing files: {str(e)}", status_code=500)


@csrf_exempt
def delete_user_file(request):
    """Delete a file or folder"""
    if request.method != 'DELETE':
        return error_response("Invalid request method. Use DELETE.", status_code=405)
    
    user, error = get_user_from_token(request)
    if error:
        return error
    
    try:
        data = json.loads(request.body)
        file_path = data.get("file_path", "").strip()
        
        if not file_path:
            return validation_error("File path is required.")
        
        # Convert username-based path to user_X format if needed
        if file_path.startswith(user.username + '/'):
            file_path = file_path.replace(user.username, f'user_{user.id}', 1)
        
        success, error_msg = FileService.delete_file(user, file_path)
        
        if not success:
            return error_response(error_msg, status_code=404)
        
        return success_response(message="File deleted successfully.")
    except json.JSONDecodeError:
        return validation_error("Invalid JSON data.")
    except Exception as e:
        return error_response(f"Error deleting file: {str(e)}", status_code=500)


@csrf_exempt
def rename_user_file(request):
    """Rename a file or folder"""
    if request.method != 'POST':
        return error_response("Invalid request method. Use POST.", status_code=405)
    
    user, error = get_user_from_token(request)
    if error:
        return error
    
    try:
        data = json.loads(request.body)
        file_path = data.get("file_path", "").strip()
        new_name = data.get("new_name", "").strip()
        
        if not file_path:
            return validation_error("File path is required.")
        if not new_name:
            return validation_error("New name is required.")
        
        # Convert username-based path to user_X format if needed
        if file_path.startswith(user.username + '/'):
            file_path = file_path.replace(user.username, f'user_{user.id}', 1)
        
        file_data, error_msg = FileService.rename_file_or_folder(user, file_path, new_name)
        
        if error_msg:
            return error_response(error_msg, status_code=400)
        
        # Convert returned path to username format for frontend
        if file_data and 'new_path' in file_data:
            original_path = file_data['new_path']
            username_path = original_path.replace(f'user_{user.id}', user.username) if original_path.startswith(f'user_{user.id}') else original_path
            file_data['new_path'] = username_path
        
        return success_response(
            data=file_data,
            message="File/folder renamed successfully.",
            status_code=200
        )
    except json.JSONDecodeError:
        return validation_error("Invalid JSON data.")
    except Exception as e:
        return error_response(f"Error renaming file: {str(e)}", status_code=500)


@csrf_exempt
def move_user_file(request):
    """Move a file or folder to a different folder"""
    if request.method != 'POST':
        return error_response("Invalid request method. Use POST.", status_code=405)
    
    user, error = get_user_from_token(request)
    if error:
        return error
    
    try:
        data = json.loads(request.body)
        source_path = data.get("source_path", "").strip()
        destination_folder = data.get("destination_folder", "").strip()
        
        if not source_path:
            return validation_error("Source path is required.")
        if not destination_folder:
            return validation_error("Destination folder is required.")
        
        # Convert username-based paths to user_X format if needed
        if source_path.startswith(user.username + '/'):
            source_path = source_path.replace(user.username, f'user_{user.id}', 1)
        if destination_folder.startswith(user.username + '/'):
            destination_folder = destination_folder.replace(user.username, f'user_{user.id}', 1)
        
        file_data, error_msg = FileService.move_file_or_folder(user, source_path, destination_folder)
        
        if error_msg:
            return error_response(error_msg, status_code=400)
        
        # Convert returned path to username format for frontend
        if file_data and 'new_path' in file_data:
            original_path = file_data['new_path']
            username_path = original_path.replace(f'user_{user.id}', user.username) if original_path.startswith(f'user_{user.id}') else original_path
            file_data['new_path'] = username_path
        
        return success_response(
            data=file_data,
            message="File/folder moved successfully.",
            status_code=200
        )
    except json.JSONDecodeError:
        return validation_error("Invalid JSON data.")
    except Exception as e:
        return error_response(f"Error moving file: {str(e)}", status_code=500)
