from django.shortcuts import render
from django.http import JsonResponse
from django.core.serializers import serialize
from django.contrib.auth.forms import AuthenticationForm, ValidationError
from django.contrib.auth.models import User
from django.contrib.auth import login
from django.contrib.gis.geos import GEOSGeometry
from django.contrib.gis.geos import Polygon
from django.contrib.gis.geos import MultiPolygon
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from django.conf import settings
import os
import sys
from itertools import chain
from tempfile import NamedTemporaryFile
import json
import fiona
from fiona.crs import from_epsg
from fiona.transform import transform_geom
from .models import Area
from .models import TaskHistory
# from .tasks import simple_test
from .tasks import report_basin
from django.shortcuts import get_object_or_404
from django.core.exceptions import RequestDataTooBig
import geopandas as gpd
from .functions import remove_z_from_geojson
import shutil
# Create your views here.

#add KML support
if not 'KML' in fiona.supported_drivers.keys():
    fiona.drvsupport.supported_drivers['KML'] = 'rw'

def showmap(request):
    if request.method == "POST":
        form = AuthenticationForm(request, data=request.POST)
        if form.is_valid():
            try:
                form.clean()
            except ValidationError:
                #TODO
                print("Error")
            login(request, form.get_user())
        else:
            #TODO
            print("Form not valid")
    return render(request, "index.html", {"loginform": AuthenticationForm})


@login_required
@csrf_exempt
def addFeature(request):
    if request.method == "POST":
        name = request.POST.get('name')
        geomstr = request.POST.get('geom')
        if name and geomstr:
            geom = GEOSGeometry(geomstr)
            if type(geom) == Polygon:
                geom = MultiPolygon([geom])
            if type(geom) == MultiPolygon:
                try:
                    ar = Area(name=name, geom=geom, user=request.user)
                    ar.save()
                    return JsonResponse({"result": "Feature saved",
                                         "featid": ar.id},
                                        status=200)
                except Exception as e:
                    msg = ", ".join(e.messages)
                    return JsonResponse({"result": "Problem saving the feature: {}".format(msg)},
                                                   status=500)
            else:
                return JsonResponse({"result": "The geometry doesn't seem a polygon"},
                                              status=400)
        elif name and not geomstr:
            return JsonResponse({"result": "The geometry was not set"},
                                          status=400)
        else:
            return JsonResponse({"result": "The geometry and the name were not set"},
                                          status=400)
    else:
        return JsonResponse({"result": "Wrong request method"}, status=400)


@login_required
@csrf_exempt
def deleteAddedArea(request, idd):
    areaGeo = Area.objects.get(id=idd)
    try:
        areaGeo.delete()
        return JsonResponse({"result": "Selected Area deleted".format(idd)},
                            status=200)
    except:
        return JsonResponse({"result": "Error deleting task id {}".format(idd)},
                            status=400)
    

@login_required
@csrf_exempt
def addUploadedLayer(request):
    try:
        if request.method == "POST":
            customName = request.POST.get('customName')
            filestr = request.POST.get('file')


            if not filestr:
                return JsonResponse({"result": "No data to get the features"}, status=400)

            if not all([customName]):
                return JsonResponse({"result": "Name must be filled."}, status=400)


            # Create a temporary file for the GeoJSON data
            with NamedTemporaryFile(delete=False) as tf:
                tf.write(filestr.encode())
                tf.flush()

                try:
                    # Read the GeoJSON file using GeoPandas
                    gdf = gpd.read_file(tf.name)

                    if gdf.crs != "EPSG:4326":
                            gdf = gdf.to_crs("EPSG:4326")


                    # Check if the geometry type is supported
                    if not all(g in ['Polygon', 'MultiPolygon'] for g in gdf.geom_type.unique()):
                        unsupported_types = [g for g in gdf.geom_type.unique() if g not in ['Polygon', 'MultiPolygon']]
                        return JsonResponse({"result": f"The supported geometry types are Polygon and MultiPolygon only. Unsupported types found: {', '.join(unsupported_types)}"}, status=400)

                    # Merge all features into a single feature
                    merged_feature = gdf.dissolve()

                    if not merged_feature.empty:

                        geom = merged_feature.geometry.iloc[0]
                        geo_interface = geom.__geo_interface__
                        
                        # Remove the z coordinates (works with both lists and tuples)
                        geo_interface["coordinates"] = remove_z_from_geojson(geo_interface["coordinates"])


                        geom_dict = {
                            "type": geom.geom_type,
                            "coordinates": geo_interface["coordinates"]
                        }
                        geomstr = json.dumps(geom_dict)
                        geom = GEOSGeometry(geomstr)

                        if isinstance(geom, Polygon):
                            geom = MultiPolygon([geom])

                        # Check if a feature with the same name already exists
                        if Area.objects.filter(name=customName, user=request.user).exists():
                            return JsonResponse({"result": f"The feature with name '{customName}' already exists in your added areas."}, status=400)

                        # Save the merged feature to the database
                        ar = Area(name=customName, geom=geom, user=request.user)
                        ar.save()
                        return JsonResponse({"result": "Feature has been saved in your added areas."}, status=200)
                    else:
                        return JsonResponse({"result": "No valid features found to save."}, status=400)
                
                except Exception as e:
                    return JsonResponse({"result": "Errors occurred while processing the file", "errors": {str(e)}}, status=400)

                finally:
                    if os.path.exists(tf.name):
                        os.remove(tf.name)
                
        else:
            return JsonResponse({"result": "Wrong request method"}, status=400)

    except Exception as e:
        return JsonResponse({"result": f"An unexpected error occurred: {str(e)}"}, status=400)
    






@login_required
@csrf_exempt
def getFeaturesList(request):
    featureType = request.POST.get('featureType')
    selected_bound_file = request.POST.get('boundaryFile')

    if featureType == "countries":
        if selected_bound_file == "fao":
            geojson_file_path = os.path.join(settings.BASE_DIR, f'staticData/FAO_world_countries.geojson')
        elif selected_bound_file == "worldbank":
            geojson_file_path = os.path.join(settings.BASE_DIR, f'staticData/WB_world_countries.geojson')
    elif featureType == "basins":
        geojson_file_path = os.path.join(settings.BASE_DIR, 'staticData/basins.geojson')

    try:
        with open(geojson_file_path, 'r') as file:
                geojson_data = json.load(file)
    except FileNotFoundError:
        return JsonResponse({'error': 'GeoJSON file not found'}, status=404)
    
    # names = sorted([
    #     feature['properties'].get('name')
    #     for feature in geojson_data.get('features', [])
    #     if 'name' in feature.get('properties', {})
    # ], key=lambda x: x.lower() if x else "")


    return JsonResponse(geojson_data, safe=False)




@login_required
@csrf_exempt
def getFeatureGeometry(request):
    if request.method == "POST":
        featureType = request.POST.get('featureType')
        selected_bound_file = request.POST.get('boundaryFile')
        featureName = request.POST.get('featureName')


        if featureType == "countries":
            if selected_bound_file == "fao":
                geojson_file_path = os.path.join(settings.BASE_DIR, f'staticData/FAO_world_countries.geojson')
            elif selected_bound_file == "worldbank":
                geojson_file_path = os.path.join(settings.BASE_DIR, f'staticData/WB_world_countries.geojson')
        elif featureType == "basins":
            geojson_file_path = os.path.join(settings.BASE_DIR, 'staticData/basins.geojson')

        try:
            with open(geojson_file_path, 'r') as file:
                    geojson_data = json.load(file)
        except FileNotFoundError:
            return JsonResponse({'error': 'GeoJSON file not found'}, status=404)

        # Find the feature that matches the command ID
        selected_feature = next((feature for feature in geojson_data['features'] if feature['properties']['name'] == featureName), None)

        if selected_feature:
            return JsonResponse(selected_feature)
        else:
            return JsonResponse({'error': 'Feature area not found'}, status=404)
    
    else:
        return JsonResponse({"result": "Wrong request method"}, status=400)
    

    

    


@login_required
@csrf_exempt
def get_task_status(request, task_id):
    print("task_id",task_id)
    task = AsyncResult(task_id)

    # if task.state in ['SUCCESS', 'FAILURE']:
    #     mapset_name = f"job_{task_id}"
    #     mapset_path = os.path.join(settings.GRASS_DB, settings.GRASS_LOCATION, mapset_name)
    #     if os.path.exists(mapset_path):
    #         shutil.rmtree(mapset_path)
    #         print(f"Mapset '{mapset_name}' removed after task completion.")

    if task.state == 'PENDING':
        response = {
            'state': task.state,
            'progress': 0,
            'status': 'Task is pending...'
        }
    elif task.state == 'PROGRESS':
        response = {
            'state': task.state,
            'progress': task.info.get('current', 0),
            'total': task.info.get('total', 100),
            'status': task.info.get('status', '')
        }
    elif task.state == 'SUCCESS':
        response = {
            'state': task.state,
            'progress': 100,
            'status': 'Task completed!'
        }
    else:
        response = {
            'state': task.state,
            'progress': 0,
            'status': str(task.info)  # task.info is the error traceback if the task failed
        }
    
    return JsonResponse(response)


@login_required
@csrf_exempt
def getReport(request):
    if request.method == "POST":
        areaid = request.POST.get('id')
        start = request.POST.get('start')
        end = request.POST.get('end')
        precip = request.POST.get('precip')
        et = request.POST.get('et')
        wri_data = request.POST.get('wri_data')
        
        myarea = Area.objects.get(id__exact=areaid)
        current_user = request.user.email
        tsk = report_basin.delay(areaid, start, end, precip, et,wri_data, current_user)
        tskhist = TaskHistory(user=request.user, area=myarea, task=tsk.id)
        tskhist.save()
        #"job id {}".format(tsk.id)
        return JsonResponse({"result": "Generating Report", "task_id": tsk.id},
                            status=200)
    else:
        return JsonResponse({"result": "Wrong request method"}, status=400)

@login_required
@csrf_exempt
def getAddedAreasList(request):
    areas = Area.objects.filter(user=request.user).values('id', 'name')

    data = list(areas)
    
    return JsonResponse(data, safe=False)

@login_required
@csrf_exempt
def get_area_geometry(request, area_id):
    area = get_object_or_404(Area, id=area_id, user=request.user)
    data = {
        'id': area.id,
        'name': area.name,
        'geometry': area.geom.geojson  # Convert geometry to GeoJSON format
    }
    return JsonResponse(data)

@login_required
@csrf_exempt
def getTasks(request):
    tasks = TaskHistory.objects.filter(user__exact=request.user)
    succededtasks = TaskResult.objects.filter(status="SUCCESS",
                              task_id__in=chain.from_iterable(tasks.values_list('task')))
    data = serialize('jsonid', tasks.filter(task__in=chain.from_iterable(succededtasks.values_list('task_id'))),
                     use_natural_primary_keys=True,
                     use_natural_foreign_keys=True)
    return JsonResponse({"data": json.loads(data)})


@login_required
@csrf_exempt
def deleteTaskHistory(request, idd):
    try:
        task = TaskHistory.objects.get(id=idd)
        task_id_str = str(task.task)


        task.delete()
        media_dir = os.path.join(settings.MEDIA_ROOT, task_id_str)
        if os.path.isdir(media_dir):
            shutil.rmtree(media_dir)

        return JsonResponse({"result": "Task id {} deleted".format(idd)},
                            status=200)
    except:
        return JsonResponse({"result": "Error deleting task id {}".format(idd)},
                            status=400)

