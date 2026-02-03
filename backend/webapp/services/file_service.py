"""
File management business logic
"""
import os
import time
import json
import geopandas as gpd
from typing import Dict, List, Optional, Tuple
from django.conf import settings
from django.contrib.gis.geos import Point, LineString, Polygon, MultiPolygon, MultiLineString, MultiPoint, GEOSGeometry
from ..models import User, Area, Folder, Asset
from pathlib import Path

# Try to import rasterio for GeoTIFF support
try:
    import rasterio
    from rasterio.warp import transform_bounds
    RASTERIO_AVAILABLE = True
except ImportError:
    RASTERIO_AVAILABLE = False


class FileService:
    """Service for managing user files and folders"""
    
    @staticmethod
    def get_user_media_dir(user: User) -> str:
        """Get the user's media directory path"""
        return os.path.join(settings.MEDIA_ROOT, f"user_{user.id}")
    
    @staticmethod
    def ensure_user_folders(user: User) -> Tuple[str, str]:
        """
        Ensure user's folder structure exists
        
        Returns:
            Tuple of (user_dir, assets_dir)
        """
        user_dir = FileService.get_user_media_dir(user)
        assets_dir = os.path.join(user_dir, "assets")
        
        os.makedirs(user_dir, exist_ok=True)
        os.makedirs(assets_dir, exist_ok=True)
        
        return user_dir, assets_dir
    
    @staticmethod
    def validate_folder_path(user_dir: str, folder_path: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Validate and normalize folder path
        Handles both user_X format and username format (converts username to user_X)
        
        Returns:
            Tuple of (normalized_path, error_message)
        """
        if not folder_path or folder_path == '':
            folder_path = 'assets'
        
        if folder_path == 'assets':
            return os.path.join(user_dir, 'assets'), None
        
        # If path starts with user_X, use as is
        # If path starts with username, we need to extract the user_id from user_dir
        # For now, assume folder_path is already in user_X format or relative to user_dir
        
        # Build target directory path
        target_dir = os.path.join(user_dir, folder_path)
        target_dir = os.path.normpath(target_dir)
        
        # Security: prevent directory traversal
        if not target_dir.startswith(user_dir):
            return None, "Invalid folder path."
        
        return target_dir, None
    
    @staticmethod
    def upload_file(user: User, uploaded_file, folder_path: str = 'assets') -> Tuple[Optional[Dict], Optional[str]]:
        """
        Upload a file to user's directory
        
        Returns:
            Tuple of (file_data_dict, error_message)
        """
        # Ensure user folders exist
        user_dir, assets_dir = FileService.ensure_user_folders(user)
        
        # Validate and get target directory
        target_dir, error = FileService.validate_folder_path(user_dir, folder_path)
        if error:
            return None, error
        
        # Create directory if it doesn't exist
        os.makedirs(target_dir, exist_ok=True)
        
        # Validate file extension - only allow geojson, geotiff, csv
        allowed_extensions = ['.geojson', '.json', '.tif', '.tiff', '.geotiff', '.csv']
        file_name = uploaded_file.name
        file_ext = os.path.splitext(file_name)[1].lower()
        
        if file_ext not in allowed_extensions:
            return None, f"File type not allowed. Only GeoJSON, GeoTIFF, and CSV files are allowed."
        
        # Save file
        file_path = os.path.join(target_dir, file_name)
        
        # Handle overwrite
        if os.path.exists(file_path):
            name, ext = os.path.splitext(file_name)
            file_name = f"{name}_{int(time.time())}{ext}"
            file_path = os.path.join(target_dir, file_name)
        
        try:
            # Save file to disk
            with open(file_path, 'wb+') as destination:
                for chunk in uploaded_file.chunks():
                    destination.write(chunk)
            
            file_size = os.path.getsize(file_path)
            relative_path = os.path.relpath(file_path, settings.MEDIA_ROOT)
            file_url = os.path.join(settings.MEDIA_URL, relative_path).replace('\\', '/')
            
            # Determine asset type from extension - only allow geojson, geotiff, csv
            asset_type = None
            if file_ext in ['.geojson', '.json']:
                asset_type = 'geojson'
            elif file_ext in ['.tif', '.tiff', '.geotiff']:
                asset_type = 'geotiff'
            elif file_ext == '.csv':
                asset_type = 'csv'
            
            # Reject unsupported file types
            if not asset_type:
                return None, f"Unsupported file type. Only GeoJSON, GeoTIFF, and CSV files are allowed."
            
            # Find parent folder in database
            parent_folder = None
            if folder_path and folder_path != 'assets':
                try:
                    if folder_path.startswith('assets/'):
                        folder_rel_path = folder_path.replace('assets/', '')
                    else:
                        folder_rel_path = folder_path
                    parent_folder = Folder.objects.filter(user=user, path=folder_rel_path).first()
                except Exception:
                    pass
            
            # Extract metadata based on file type
            metadata = {}
            if asset_type == 'geotiff':
                # Extract bounds/extent from GeoTIFF
                if RASTERIO_AVAILABLE:
                    try:
                        metadata = FileService._extract_geotiff_metadata(file_path)
                    except Exception as e:
                        import logging
                        logger = logging.getLogger(__name__)
                        logger.warning(f"Failed to extract GeoTIFF metadata: {str(e)}")
                        metadata = {'type': 'geotiff', 'error': str(e)}
                else:
                    metadata = {'type': 'geotiff', 'error': 'rasterio not available'}
            elif asset_type == 'csv':
                # Basic CSV metadata
                metadata = {
                    'type': 'csv',
                    'rows': 0,  # Could be calculated if needed
                }
            
            # Create or update asset in database
            relative_db_path = relative_path.replace(f'user_{user.id}/', '')
            db_asset, created = Asset.objects.update_or_create(
                user=user,
                name=file_name,
                folder=parent_folder,
                defaults={
                    'asset_type': asset_type,
                    'file_path': relative_db_path,
                    'file_size': file_size,
                    'file_extension': file_ext.replace('.', ''),
                    'mime_type': uploaded_file.content_type or '',
                    'metadata': metadata,
                }
            )
            
            return {
                "id": db_asset.id,
                "file_name": file_name,
                "file_path": relative_path,
                "file_url": file_url,
                "file_size": file_size,
                "folder_path": folder_path,
                "db_id": db_asset.id,
                "asset_type": asset_type
            }, None
        except Exception as e:
            return None, f"Error uploading file: {str(e)}"
    
    @staticmethod
    def create_folder(user: User, folder_name: str, parent_path: str = '') -> Tuple[Optional[Dict], Optional[str]]:
        """
        Create a new folder (both in database and file system)
        
        Returns:
            Tuple of (folder_data_dict, error_message)
        """
        if not folder_name or not folder_name.strip():
            return None, "Folder name is required."
        
        folder_name = folder_name.strip()
        
        # Validate folder name (no path separators)
        if '/' in folder_name or '\\' in folder_name:
            return None, "Folder name cannot contain path separators."
        
        user_dir, _ = FileService.ensure_user_folders(user)
        
        # Find or create parent folder in database
        parent_folder = None
        if parent_path and parent_path != 'assets':
            # Try to find parent folder in database
            try:
                # Extract relative path
                if parent_path.startswith('assets/'):
                    parent_rel_path = parent_path.replace('assets/', '')
                else:
                    parent_rel_path = parent_path
                
                # Find parent folder by path
                parent_folder = Folder.objects.filter(user=user, path=parent_rel_path).first()
            except Exception:
                pass
        
        # Check if folder already exists in database
        existing_db_folder = Folder.objects.filter(user=user, name=folder_name, parent=parent_folder).first()
        if existing_db_folder:
            return None, "Folder already exists."
        
        # Create in file system
        if parent_path:
            parent_dir, error = FileService.validate_folder_path(user_dir, parent_path)
            if error:
                return None, error
        else:
            parent_dir = os.path.join(user_dir, 'assets')
        
        new_folder_path = os.path.join(parent_dir, folder_name)
        
        # Security check
        new_folder_path = os.path.normpath(new_folder_path)
        if not new_folder_path.startswith(user_dir):
            return None, "Invalid folder path."
        
        if os.path.exists(new_folder_path):
            return None, "Folder already exists in file system."
        
        try:
            # Create in file system
            os.makedirs(new_folder_path, exist_ok=True)
            relative_path = os.path.relpath(new_folder_path, settings.MEDIA_ROOT)
            
            # Create in database
            db_folder = Folder(
                user=user,
                name=folder_name,
                parent=parent_folder,
                path=relative_path.replace(f'user_{user.id}/', '').replace('assets/', '') if 'assets/' in relative_path else relative_path.replace(f'user_{user.id}/', '')
            )
            db_folder.save()
            
            return {
                "id": db_folder.id,
                "folder_name": folder_name,
                "folder_path": relative_path,
                "db_id": db_folder.id
            }, None
        except Exception as e:
            return None, f"Error creating folder: {str(e)}"
    
    @staticmethod
    def list_files(user: User, folder_path: str = 'assets') -> Tuple[Optional[List[Dict]], Optional[str]]:
        """
        List files and folders from database (with file system sync)
        
        Returns:
            Tuple of (files_list, error_message)
        """
        user_dir, assets_dir = FileService.ensure_user_folders(user)
        
        # Validate and get target directory
        target_dir, error = FileService.validate_folder_path(user_dir, folder_path)
        if error:
            return None, error
        
        try:
            # Find parent folder in database
            parent_folder = None
            if folder_path and folder_path != 'assets':
                try:
                    if folder_path.startswith('assets/'):
                        folder_rel_path = folder_path.replace('assets/', '')
                    else:
                        folder_rel_path = folder_path
                    parent_folder = Folder.objects.filter(user=user, path=folder_rel_path).first()
                except Exception:
                    pass
            
            # Get folders from database
            db_folders = Folder.objects.filter(user=user, parent=parent_folder).order_by('name')
            # Get assets from database
            db_assets = Asset.objects.filter(user=user, folder=parent_folder).order_by('name')
            
            files_list = []
            
            # Add folders
            for folder in db_folders:
                relative_path = f"user_{user.id}/{folder.path}" if not folder.path.startswith('user_') else folder.path
                files_list.append({
                    "id": folder.id,
                    "name": folder.name,
                    "type": "folder",
                    "path": relative_path.replace('\\', '/'),
                    "created_at": folder.created_at.isoformat() if folder.created_at else None
                })
            
            # Add files
            for asset in db_assets:
                relative_path = f"user_{user.id}/{asset.file_path}" if not asset.file_path.startswith('user_') else asset.file_path
                
                # Get metadata, and if stored in PostGIS and metadata lacks bounds, fetch from Area model
                metadata = asset.metadata if asset.metadata else {}
                
                # If GeoJSON is stored in PostGIS and metadata doesn't have bounds, fetch from Area
                if asset.is_geojson_in_postgis and asset.postgis_area_id:
                    try:
                        # Area is already imported at the top of the file
                        area = Area.objects.get(id=asset.postgis_area_id, user=user)
                        if area.geom and not metadata.get('bounds') and not metadata.get('bbox'):
                            # Extract bounds from geometry (geom is MultiPolygonField)
                            extent = area.geom.extent  # Returns (minx, miny, maxx, maxy)
                            metadata['bounds'] = {
                                'minx': float(extent[0]),
                                'miny': float(extent[1]),
                                'maxx': float(extent[2]),
                                'maxy': float(extent[3]),
                            }
                            metadata['bbox'] = [float(extent[0]), float(extent[1]), float(extent[2]), float(extent[3])]
                            # Also ensure other metadata fields are present
                            if 'type' not in metadata:
                                metadata['type'] = 'geojson'
                            if 'crs' not in metadata:
                                metadata['crs'] = 'EPSG:4326'
                            # Update asset metadata in database for future use
                            asset.metadata = metadata
                            asset.save(update_fields=['metadata'])
                    except Area.DoesNotExist:
                        # Area not found - continue with existing metadata
                        pass
                    except Exception as e:
                        # Silently continue if Area fetch fails - don't break the file listing
                        import logging
                        logger = logging.getLogger(__name__)
                        logger.warning(f"Failed to fetch bounds from Area for asset {asset.id}: {str(e)}")
                        # Continue with existing metadata
                        pass
                
                files_list.append({
                    "id": asset.id,
                    "name": asset.name,
                    "type": "file",
                    "path": relative_path.replace('\\', '/'),
                    "size": asset.file_size,
                    "extension": asset.file_extension,
                    "asset_type": asset.asset_type,
                    "url": asset.get_file_url(),
                    "is_geojson_in_postgis": asset.is_geojson_in_postgis,
                    "postgis_area_id": asset.postgis_area_id,
                    "metadata": metadata,  # Include metadata with bounds/extent
                    "created_at": asset.created_at.isoformat() if asset.created_at else None
                })
            
            return files_list, None
        except Exception as e:
            return None, f"Error listing files: {str(e)}"
    
    @staticmethod
    def delete_file(user: User, file_path: str) -> Tuple[bool, Optional[str]]:
        """
        Delete a file or folder (from both database and file system)
        
        Returns:
            Tuple of (success, error_message)
        """
        user_dir, _ = FileService.ensure_user_folders(user)
        
        # Build full path
        if file_path.startswith('user_'):
            full_path = os.path.join(settings.MEDIA_ROOT, file_path)
            relative_path = file_path
        else:
            full_path = os.path.join(user_dir, file_path)
            relative_path = os.path.relpath(full_path, settings.MEDIA_ROOT)
        
        full_path = os.path.normpath(full_path)
        
        # Security check
        if not full_path.startswith(user_dir):
            return False, "Invalid file path."
        
        try:
            # Try to find in database first
            relative_db_path = relative_path.replace(f'user_{user.id}/', '')
            
            # Check if it's a folder
            db_folder = Folder.objects.filter(user=user, path=relative_db_path).first()
            if db_folder:
                # Delete folder and all its contents (cascade)
                # Delete subfolders and assets recursively
                FileService._delete_folder_recursive(db_folder)
                # Delete from file system
                if os.path.exists(full_path):
                    import shutil
                    shutil.rmtree(full_path)
                return True, None
            
            # Check if it's an asset
            db_asset = Asset.objects.filter(user=user, file_path=relative_db_path).first()
            if db_asset:
                # Delete from database
                db_asset.delete()
                # Delete from file system
                if os.path.exists(full_path):
                    os.remove(full_path)
                return True, None
            
            # If not found in database, still try to delete from file system
            if not os.path.exists(full_path):
                return False, "File or folder not found."
            
            import shutil
            if os.path.isdir(full_path):
                shutil.rmtree(full_path)
            else:
                os.remove(full_path)
            return True, None
        except Exception as e:
            return False, f"Error deleting file: {str(e)}"
    
    @staticmethod
    def _delete_folder_recursive(folder: Folder):
        """Recursively delete folder and all its contents from database"""
        # Delete all assets in this folder
        Asset.objects.filter(folder=folder).delete()
        
        # Delete all subfolders recursively
        for subfolder in Folder.objects.filter(parent=folder):
            FileService._delete_folder_recursive(subfolder)
        
        # Delete the folder itself
        folder.delete()
    
    @staticmethod
    def save_geojson_to_postgis(user: User, geojson_data: str, area_name: str, folder_path: str = 'assets') -> Tuple[Optional[Dict], Optional[str]]:
        """
        Save GeoJSON data to PostGIS using Area model
        
        Args:
            user: User instance
            geojson_data: GeoJSON string or dict
            area_name: Name for the area
            
        Returns:
            Tuple of (area_data_dict, error_message)
        """
        try:
            # Parse GeoJSON if string
            if isinstance(geojson_data, str):
                geojson = json.loads(geojson_data)
            else:
                geojson = geojson_data
            
            # Normalize into list of features
            if geojson.get("type") == "FeatureCollection":
                features = geojson["features"]
            elif geojson.get("type") == "Feature":
                features = [geojson]
            elif geojson.get("type") in ["Polygon", "MultiPolygon", "LineString", "MultiLineString", "Point", "MultiPoint"]:
                # Raw geometry — wrap as Feature
                features = [{
                    "type": "Feature",
                    "properties": {},
                    "geometry": geojson
                }]
            else:
                return None, f"Unsupported GeoJSON type: {geojson.get('type')}"
            
            # Convert to GeoDataFrame
            gdf = gpd.GeoDataFrame.from_features(features)
            
            # Ensure CRS is EPSG:4326
            if gdf.crs and gdf.crs != 'EPSG:4326':
                gdf = gdf.to_crs('EPSG:4326')
            else:
                gdf.set_crs('EPSG:4326', inplace=True)
            
            # Merge geometries
            merged_geometry = gdf.unary_union
            if merged_geometry.is_empty:
                return None, "Empty geometry after merge"
            
            # Extract bounds/extent before converting to GEOS
            bounds = gdf.total_bounds  # [minx, miny, maxx, maxy]
            extent = {
                'minx': float(bounds[0]),
                'miny': float(bounds[1]),
                'maxx': float(bounds[2]),
                'maxy': float(bounds[3]),
            }
            bbox = [float(bounds[0]), float(bounds[1]), float(bounds[2]), float(bounds[3])]  # [minx, miny, maxx, maxy]
            
            # Convert to GEOS geometry
            geom = GEOSGeometry(merged_geometry.wkt)
            
            # Convert to Multi* types
            if isinstance(geom, Polygon):
                geom = MultiPolygon([geom])
            elif isinstance(geom, LineString):
                geom = MultiLineString([geom])
            elif isinstance(geom, Point):
                geom = MultiPoint([geom])
            
            if not isinstance(geom, (MultiPolygon, MultiLineString, MultiPoint)):
                return None, "Unsupported geometry type"
            
            # Check if area with same name exists
            existing = Area.objects.filter(user=user, name__iexact=area_name).first()
            if existing:
                # Update existing area
                existing.geom = geom
                existing.save()
                area = existing
            else:
                # Create new area
                area = Area(
                    name=area_name,
                    geom=geom,
                    user=user,
                )
                area.save()
            
            # Create or update Asset record in database with metadata
            try:
                # Find parent folder
                parent_folder = None
                if folder_path and folder_path != 'assets':
                    try:
                        if folder_path.startswith('assets/'):
                            folder_rel_path = folder_path.replace('assets/', '')
                        else:
                            folder_rel_path = folder_path
                        parent_folder = Folder.objects.filter(user=user, path=folder_rel_path).first()
                    except Exception:
                        pass
                
                # Create metadata with bounds/extent
                metadata = {
                    'type': 'geojson',
                    'features': len(features),
                    'crs': 'EPSG:4326',
                    'bounds': extent,
                    'bbox': bbox,
                }
                
                # Create asset record
                asset_name = f"{area_name}.geojson"
                db_asset, created = Asset.objects.update_or_create(
                    user=user,
                    name=asset_name,
                    folder=parent_folder,
                    defaults={
                        'asset_type': 'geojson',
                        'file_path': f"{folder_path}/{asset_name}" if folder_path != 'assets' else f"assets/{asset_name}",
                        'file_size': len(geojson_data.encode('utf-8')),
                        'file_extension': 'geojson',
                        'is_geojson_in_postgis': True,
                        'postgis_area_id': area.id,
                        'metadata': metadata,
                    }
                )
            except Exception as e:
                # Log error but don't fail the operation
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Failed to create Asset record: {str(e)}")
            
            return {
                "id": area.id,
                "name": area.name,
                "type": "area",
                "message": "GeoJSON saved to PostGIS successfully"
            }, None
            
        except json.JSONDecodeError as e:
            return None, f"Invalid GeoJSON format: {str(e)}"
        except Exception as e:
            return None, f"Error saving GeoJSON to PostGIS: {str(e)}"
    
    @staticmethod
    def rename_file_or_folder(user: User, old_path: str, new_name: str) -> Tuple[Optional[Dict], Optional[str]]:
        """
        Rename a file or folder
        
        Args:
            user: User instance
            old_path: Current path of file/folder
            new_name: New name (without path)
            
        Returns:
            Tuple of (file_data_dict, error_message)
        """
        user_dir, _ = FileService.ensure_user_folders(user)
        
        # Build full path
        if old_path.startswith('user_'):
            full_old_path = os.path.join(settings.MEDIA_ROOT, old_path)
        else:
            full_old_path = os.path.join(user_dir, old_path)
        
        full_old_path = os.path.normpath(full_old_path)
        
        # Security check
        if not full_old_path.startswith(user_dir):
            return None, "Invalid file path."
        
        if not os.path.exists(full_old_path):
            return None, "File or folder not found."
        
        # Validate new name
        if not new_name or not new_name.strip():
            return None, "New name is required."
        
        new_name = new_name.strip()
        
        # Validate folder name (no path separators)
        if '/' in new_name or '\\' in new_name:
            return None, "Name cannot contain path separators."
        
        # Build new path
        old_dir = os.path.dirname(full_old_path)
        full_new_path = os.path.join(old_dir, new_name)
        
        # Check if new name already exists
        if os.path.exists(full_new_path):
            return None, f"A file or folder with the name '{new_name}' already exists."
        
        try:
            # Rename in file system
            os.rename(full_old_path, full_new_path)
            
            # Build relative path for response
            relative_new_path = os.path.relpath(full_new_path, settings.MEDIA_ROOT)
            relative_db_path = relative_new_path.replace(f'user_{user.id}/', '')
            
            # Update database
            # Check if it's a folder
            old_db_path = old_path.replace(f'user_{user.id}/', '') if old_path.startswith('user_') else old_path
            db_folder = Folder.objects.filter(user=user, path=old_db_path).first()
            if db_folder:
                db_folder.name = new_name
                db_folder.path = relative_db_path
                db_folder.save()
                return {
                    "id": db_folder.id,
                    "old_path": old_path,
                    "new_path": relative_new_path,
                    "new_name": new_name,
                    "type": "folder"
                }, None
            
            # Check if it's an asset
            db_asset = Asset.objects.filter(user=user, file_path=old_db_path).first()
            if db_asset:
                db_asset.name = new_name
                db_asset.file_path = relative_db_path
                db_asset.save()
                return {
                    "id": db_asset.id,
                    "old_path": old_path,
                    "new_path": relative_new_path,
                    "new_name": new_name,
                    "type": "file"
                }, None
            
            return {
                "old_path": old_path,
                "new_path": relative_new_path,
                "new_name": new_name
            }, None
        except Exception as e:
            return None, f"Error renaming: {str(e)}"
    
    @staticmethod
    def move_file_or_folder(user: User, source_path: str, destination_folder: str) -> Tuple[Optional[Dict], Optional[str]]:
        """
        Move a file or folder to a different folder
        
        Args:
            user: User instance
            source_path: Path of file/folder to move
            destination_folder: Destination folder path
            
        Returns:
            Tuple of (file_data_dict, error_message)
        """
        user_dir, _ = FileService.ensure_user_folders(user)
        
        # Build source path
        if source_path.startswith('user_'):
            full_source_path = os.path.join(settings.MEDIA_ROOT, source_path)
        else:
            full_source_path = os.path.join(user_dir, source_path)
        
        full_source_path = os.path.normpath(full_source_path)
        
        # Security check for source
        if not full_source_path.startswith(user_dir):
            return None, "Invalid source path."
        
        if not os.path.exists(full_source_path):
            return None, "Source file or folder not found."
        
        # Validate and get destination directory
        dest_dir, error = FileService.validate_folder_path(user_dir, destination_folder)
        if error:
            return None, error
        
        # Ensure destination exists
        os.makedirs(dest_dir, exist_ok=True)
        
        # Get item name
        item_name = os.path.basename(full_source_path)
        full_dest_path = os.path.join(dest_dir, item_name)
        
        # Check if destination already exists
        if os.path.exists(full_dest_path):
            return None, f"A file or folder with the name '{item_name}' already exists in the destination."
        
        # Prevent moving folder into itself or its subfolder
        if os.path.isdir(full_source_path):
            if full_dest_path.startswith(full_source_path + os.sep) or full_dest_path == full_source_path:
                return None, "Cannot move a folder into itself or its subfolder."
        
        try:
            import shutil
            # Move in file system
            shutil.move(full_source_path, full_dest_path)
            
            # Build relative path for response
            relative_dest_path = os.path.relpath(full_dest_path, settings.MEDIA_ROOT)
            relative_db_dest_path = relative_dest_path.replace(f'user_{user.id}/', '')
            
            # Find destination folder in database
            dest_db_folder = None
            if destination_folder and destination_folder != 'assets':
                try:
                    if destination_folder.startswith('assets/'):
                        dest_folder_rel_path = destination_folder.replace('assets/', '')
                    else:
                        dest_folder_rel_path = destination_folder
                    dest_db_folder = Folder.objects.filter(user=user, path=dest_folder_rel_path).first()
                except Exception:
                    pass
            
            # Update database
            source_db_path = source_path.replace(f'user_{user.id}/', '') if source_path.startswith('user_') else source_path
            
            # Check if it's a folder
            db_folder = Folder.objects.filter(user=user, path=source_db_path).first()
            if db_folder:
                db_folder.parent = dest_db_folder
                db_folder.path = relative_db_dest_path.replace('assets/', '') if 'assets/' in relative_db_dest_path else relative_db_dest_path
                db_folder.save()
                # Update all subfolders' paths recursively
                FileService._update_folder_paths_recursive(db_folder)
                return {
                    "id": db_folder.id,
                    "old_path": source_path,
                    "new_path": relative_dest_path,
                    "destination": destination_folder,
                    "type": "folder"
                }, None
            
            # Check if it's an asset
            db_asset = Asset.objects.filter(user=user, file_path=source_db_path).first()
            if db_asset:
                db_asset.folder = dest_db_folder
                db_asset.file_path = relative_db_dest_path
                db_asset.save()
                return {
                    "id": db_asset.id,
                    "old_path": source_path,
                    "new_path": relative_dest_path,
                    "destination": destination_folder,
                    "type": "file"
                }, None
            
            return {
                "old_path": source_path,
                "new_path": relative_dest_path,
                "destination": destination_folder
            }, None
        except Exception as e:
            return None, f"Error moving: {str(e)}"
    
    @staticmethod
    def _update_folder_paths_recursive(folder: Folder):
        """Recursively update paths for all subfolders"""
        for subfolder in Folder.objects.filter(parent=folder):
            if subfolder.parent:
                subfolder.path = f"{subfolder.parent.path}/{subfolder.name}"
            else:
                subfolder.path = subfolder.name
            subfolder.save()
            FileService._update_folder_paths_recursive(subfolder)
    
    @staticmethod
    def _extract_geotiff_metadata(file_path: str) -> Dict:
        """
        Extract metadata including bounds/extent from GeoTIFF file
        
        Returns:
            Dictionary with metadata including bounds, crs, dimensions, etc.
        """
        try:
            with rasterio.open(file_path) as src:
                # Get bounds in the file's CRS
                bounds = src.bounds
                
                # Transform bounds to EPSG:4326 (WGS84) if needed
                if src.crs and src.crs.to_string() != 'EPSG:4326':
                    bounds_4326 = transform_bounds(src.crs, 'EPSG:4326', *bounds)
                    minx, miny, maxx, maxy = bounds_4326
                else:
                    minx, miny, maxx, maxy = bounds.left, bounds.bottom, bounds.right, bounds.top
                
                metadata = {
                    'type': 'geotiff',
                    'crs': src.crs.to_string() if src.crs else 'EPSG:4326',
                    'bounds': {
                        'minx': float(minx),
                        'miny': float(miny),
                        'maxx': float(maxx),
                        'maxy': float(maxy),
                    },
                    'bbox': [float(minx), float(miny), float(maxx), float(maxy)],
                    'width': int(src.width),
                    'height': int(src.height),
                    'count': int(src.count),
                    'dtype': str(src.dtypes[0]) if src.dtypes else None,
                    'transform': list(src.transform)[:6] if src.transform else None,
                }
                
                return metadata
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error extracting GeoTIFF metadata: {str(e)}")
            return {
                'type': 'geotiff',
                'error': str(e)
            }
