"""
Area management views - thin HTTP layer
"""
import json
import geopandas as gpd
from django.views.decorators.csrf import csrf_exempt
from django.contrib.gis.geos import Point, LineString, Polygon, MultiPolygon, MultiLineString, MultiPoint, GEOSGeometry
from ..models import Area, Asset, Folder
from ..utils.response_helpers import success_response, error_response, validation_error
from ..utils.auth_helpers import get_user_from_token


@csrf_exempt
def save_draw_geojson(request):
    """Save drawn GeoJSON geometry"""
    if request.method != 'POST':
        return error_response("Invalid request method. Use POST.", status_code=405)
    
    user, error = get_user_from_token(request)
    if error:
        return error
    
    try:
        data = json.loads(request.body)
        feature_name = data.get('name')
        geo_json_str = data.get('geom')
        
        if not feature_name:
            return validation_error("Feature name is required")
        if not geo_json_str:
            return validation_error("The geometry was not set")
        
        geojson = json.loads(geo_json_str)
        gdf = gpd.GeoDataFrame.from_features(geojson["features"])
        
        if gdf.crs and gdf.crs != 'EPSG:4326':
            gdf = gdf.to_crs('EPSG:4326')
        else:
            gdf.set_crs('EPSG:4326', inplace=True)
        
        merged_geometry = gdf.unary_union
        if merged_geometry.is_empty:
            return validation_error("Empty geometry after merge")
        
        geom = GEOSGeometry(merged_geometry.wkt)
        if isinstance(geom, Polygon):
            geom = MultiPolygon([geom])
        elif isinstance(geom, LineString):
            geom = MultiLineString([geom])
        elif isinstance(geom, Point):
            geom = MultiPoint([geom])
        
        if not isinstance(geom, (MultiPolygon, MultiLineString, MultiPoint)):
            return validation_error("Unsupported geometry type")
        
        # Check if area with same name exists
        existing = Area.objects.filter(user=user, name__iexact=feature_name).first()
        if existing:
            # Update existing area
            existing.geom = geom
            existing.save()
            area = existing
        else:
            # Create new area
            area = Area(
                name=feature_name,
                geom=geom,
                user=user,
            )
            area.save()
        
        # Extract bounds/extent for metadata
        bounds = gdf.total_bounds  # [minx, miny, maxx, maxy]
        extent = {
            'minx': float(bounds[0]),
            'miny': float(bounds[1]),
            'maxx': float(bounds[2]),
            'maxy': float(bounds[3]),
        }
        bbox = [float(bounds[0]), float(bounds[1]), float(bounds[2]), float(bounds[3])]
        
        # Create or update Asset record in database with metadata
        try:
            # Find assets folder (root folder)
            assets_folder = Folder.objects.filter(user=user, name='assets', parent=None).first()
            if not assets_folder:
                # Create assets folder if it doesn't exist
                from ..services.file_service import FileService
                user_dir, assets_dir = FileService.ensure_user_folders(user)
                relative_path = f"user_{user.id}/assets"
                assets_folder = Folder(
                    user=user,
                    name='assets',
                    parent=None,
                    path='assets'
                )
                assets_folder.save()
            
            # Create metadata with bounds/extent
            metadata = {
                'type': 'geojson',
                'features': len(gdf),
                'crs': 'EPSG:4326',
                'bounds': extent,
                'bbox': bbox,
            }
            
            # Create asset record
            asset_name = f"{feature_name}.geojson"
            Asset.objects.update_or_create(
                user=user,
                name=asset_name,
                folder=assets_folder,
                defaults={
                    'asset_type': 'geojson',
                    'file_path': f'assets/{asset_name}',
                    'file_size': 0,  # Drawn boundaries don't have file size
                    'file_extension': 'geojson',
                    'is_geojson_in_postgis': True,
                    'postgis_area_id': area.id,
                    'metadata': metadata,
                }
            )
        except Exception as e:
            # Log error but don't fail the request
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to create Asset record for drawn area: {str(e)}")
        
        return success_response(data={
            "id": area.id,
            "name": area.name,
            "message": "Area saved successfully!"
        })
    except json.JSONDecodeError:
        return validation_error("Invalid JSON data.")
    except Exception as e:
        return error_response(f"Error saving area: {str(e)}", status_code=500)


@csrf_exempt
def get_added_areas_list(request):
    """Get list of areas for authenticated user"""
    user, error = get_user_from_token(request)
    if error:
        return error
    
    try:
        areas = Area.objects.filter(user=user).order_by('-id')
        areas_data = []
        for area in areas:
            areas_data.append({
                "id": area.id,
                "name": area.name,
                "created_at": area.id  # Add proper timestamp if available
            })
        
        return success_response(data=areas_data)
    except Exception as e:
        return error_response(f"Error fetching areas: {str(e)}", status_code=500)


@csrf_exempt
def get_area_geometry(request, areaId):
    """Get geometry for a specific area"""
    user, error = get_user_from_token(request)
    if error:
        return error
    
    try:
        area = Area.objects.get(id=areaId, user=user)
        # Serialize geometry as GeoJSON
        geojson = area.geom.geojson
        return success_response(data={"geometry": json.loads(geojson)})
    except Area.DoesNotExist:
        return error_response("Area not found", status_code=404)
    except Exception as e:
        return error_response(f"Error fetching area: {str(e)}", status_code=500)


@csrf_exempt
def delete_area_geom(request, id):
    """Delete an area"""
    user, error = get_user_from_token(request)
    if error:
        return error
    
    try:
        area = Area.objects.get(id=id, user=user)
        area.delete()
        return success_response(message="Area deleted successfully.")
    except Area.DoesNotExist:
        return error_response("Area not found", status_code=404)
    except Exception as e:
        return error_response(f"Error deleting area: {str(e)}", status_code=500)
