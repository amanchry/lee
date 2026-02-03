Water Water Accounting Report Generator
=============
This project uses Next JS (frontend) and a Django backend, with Apache acting as a reverse proxy.






=============
BACKEND
=============
System dependencies
=============

* In a new system (Only tested in Ubuntu server) install the following software

  * PostgreSQL and its developing package
  * PostGIS
  * GRASS GIS
  * redis
  * git
  * GDAL software 
  * Apache
  * Virtualenv
  * Compilers



**Install following packages**

Open a terminal and use following commands to install required libraries.

`sudo apt-get install git gdal-bin apache2 postgis redis-server virtualenv build-essential python3-dev libpq-dev pango1.0-tools`
`sudo apt-get install postgresql postgresql-postgis`
`sudo apt install certbot python3-certbot-apache`

* Install grass gis using following commands

`sudo add-apt-repository ppa:ubuntugis/ubuntugis-unstable`

`sudo apt-get install grass grass-dev`

* Create a new grass location for wagen_global app

`grass -c EPSG:4326 -e /path/to/grassdata/wagen_global`

(Note that, in settings.py file "GRASS_DB" should be set as "/path/to/grassdata")

* Create an empty PostgreSQL database with PostGIS extension

`sudo -u postgres createuser wagen_chat`

Open psql in the terminal using following command

`sudo -u postgres psql`

In the psql command:

| *# Change password of postgres user

| `ALTER USER postgres PASSWORD 'wagen_chat123';`
| `ALTER USER wagen_chat PASSWORD 'wagen_chat123';`
| *# Give more privileges to user wagen_chat*
| `ALTER USER wagen_chat WITH SUPERUSER;`
| *# quit psql*
| `\q`

Create a new DB named "wagen_chat":

| `createdb -U YOURUSER -h YOURHOST wagen_chat`
| `psql -U YOURUSER -h YOURHOST wagen_chat -c "CREATE EXTENSION postgis"`

.. createdb -U wagen_chat -h localhost wagen_chat
.. pass: wagen_chat123
.. psql -U wagen_chat -h localhost wagen_chat -c "CREATE EXTENSION postgis"
.. 

* Download this source code and enter in directory wagen_chat/webapp



=============
FRONTEND
=============

cd frontend

npm install
npm start
npm run build
npm run dev --port 3007



* Create a Python 3 virtual environment in the webapp directory

`python3 -m venv venv`

* Activate the virtual environment

`source venv/bin/activate`

.. If using conda
`conda activate django`


* Install dependencies with `pip`

`pip install -r requirements.txt`

.. gdal installation: if getting error
`pip install --no-binary=:all: GDAL==3.8.4`


* Set connection to the database and create its structure


  # add user, password and grass settings in wagen_chat/settings.py

  `python manage.py makemigrations webapp`
  `python manage.py migrate`

  .. Now collectstatic is important because now these will be served through custom "django_static" folder

  `python manage.py collectstatic`

  # create a new user to access the features of web app
  `python manage.py createsuperuser --username admin`

  .. email: aman.chaudhary@iitgn.ac.in
  .. pass: aman
  .. username: admin

  # to see the help
  `python manage.py help`




=============
TESTING
=============

* Start celery worker to use asynchronous requests

  `celery -A backend worker -l INFO`

* At this point you could run the app

  `python3 manage.py runserver`

*run this to access on other device too

  `python manage.py runserver 127.0.0.1:8005`



* Open web browser at http://127.0.0.1:8000/



=============
SCREEN
=============
To attach a screen : 
`screen -r 392898.wagen_chat_server`
`screen -r 393313.wagen_chat_celery`

Then control+ C:

Detach a screen
`screen -d 404581.wagen_chat_server`

To delete a screen 
`screen -S 356415.wagen_chat_server -X quit`

Start a new screen
`screen -S wagen_chat_server`
`screen -S wagen_chat_celery`




=============
DEPLOYMENT
=============
* Create all the stuff needed to run celery in deployment mode

  ```bash
  # create the pid directory
  `sudo mkdir /var/run/celery/`
  `sudo chown -R aman:aman /var/run/celery/`

  # copy the systemd configuration file
  `ln -s /home/aman/wagen_chat/webapp/wagen_chat/celery_wagen_chat.service /etc/systemd/system`
  .. sudo ln -s /home/aman/wagen_chat/webapp/wagen_chat/celery_wagen_chat.service /etc/systemd/system


.. EnvironmentFile=-/home/aman/wagen_chat/webapp/wagen_chat/celery.conf
.. WorkingDirectory=/home/aman/wagen_chat/webapp/wagen_chat/

  # modify the environment file if needed 
  # (for example the timeout for a single job set to 3000 seconds or number of concurrency set to 8)

  # reload the systemd files (this has been done everytime celery_wagen_chat.service is changed)
  `sudo systemctl daemon-reload`
  # enable the service to be automatically start on boot
  `sudo systemctl enable celery_wagen_global.service`
  ```

* Start the celery app

  
  sudo systemctl start celery_wagen_global.service
  # to look if everything is working properly you can

  sudo systemctl status celery_wagen_global.service


  .. ls -lh /home/aman/wagen_global/webapp/wagen_global/log/celery/
  .. tail -f /home/aman/wagen_global/webapp/wagen_global/log/celery/worker1.log

  

* Copy the template `ini` file and modify the paths

  ```bash
  cp wagen_global/template_wagen.ini wagen_global/wagen_global.ini
  ```

* Copy the template Apache configuration file and modify it, specially the path

  ```bash
  sudo cp wagen_global/template_apache.conf /etc/apache2/sites-available/wagen_global.conf
  ```
* Install uwsgi python package in the venv
  (install it in the virtualenv environment)

* Install uwsgi libapache in the ubuntu system

  `sudo apt install libapache2-mod-uwsgi`

* Enable uwsgi and ssl module in apache

  `sudo a2enmod uwsgi`
  `sudo a2enmod ssl`

* Run the Django app using `uwsgi`
  (first, enable virtualenv environment)
  `uwsgi --ini wagen_global.ini`


* Activate the Apache configuration file
  `sudo a2ensite wagen_global.conf`
  `sudo systemctl restart apache2`




`sudo systemctl start celery_wagen_global.service`
`uwsgi --ini /home/aman/wagen_global/webapp/wagen_global/wagen_global.ini`




=================================================================
Restart the celery and uWSGI in development after updates
=================================================================


#Stop Celery Service
`sudo systemctl stop celery_wagen_global.service`

#Kill Remaining Celery Processes
`sudo pkill -9 -f 'celery worker'`

#Ensure All Processes Are Stoppedps aux | grep celery
`ps aux | grep celery`

# reload the systemd files (this has been done everytime celery_wagen_global.service is changed)
`sudo systemctl daemon-reload`


#Start Celery Service
`sudo systemctl start celery_wagen_global.service`

#Verify Celery is Running Correctly
`sudo systemctl status celery_wagen_global.service`


#Monitoring Logs
`tail -f 100 /home/aman/wagen_global/log/celery/worker1-7.log
tail -f 100 /home/aman/wagen_global/log/celery/worker1-6.log
tail -f 100 /home/aman/wagen_global/log/celery/worker1.log`

`tail -f /home/aman/wagen_global/log/celery/worker1-7.log`

`for file in /home/aman/wagen_global/log/celery/*.log; do
    echo "Checking $file"
    tail -n 20 $file
done`



# To stop uWSGI
`killall uwsgi`

#Restart uWSGI (first activate the venv)
`uwsgi --ini wagen_global.ini`



=================================================================
Restart the uWSGI in development after updates
=================================================================

** check all the running uWSGI workers
`ps aux | grep uwsgi`

** Kill all the workers
`sudo killall -9 uwsgi`


#Restart uWSGI (first activate the venv)
`uwsgi --ini geochat.ini`





=============
Apache commands
=============
* Enable the proxy-pass
`sudo a2enmod proxy
sudo a2enmod proxy_http

* Enable the virtual host with the following command:**
`sudo a2ensite global.waterinag.org.conf`

* To disable site**
(here global.waterinag.org.conf is apache conf file for global.waterinag.org website)
`sudo a2dissite global.waterinag.org.conf`


* Restart the Apache webserver to apply the changes:
`sudo systemctl reload apache2`
`sudo systemctl restart apache2`

* List all the enabled sites**
`ls -l /etc/apache2/sites-enabled`

* Test the apache configuration:**
`sudo apachectl configtest`


* Install certbot in Ubuntu (enable ssl certificate)
`sudo apt install certbot python3-certbot-apache`

* Set SSL and enable https**
`sudo certbot --apache -d global.waterinag.org`


* Apache error log
sudo tail -n 50 /var/log/apache2/wagen_error.log



.. frontend permissions
# Give Apache read + execute permission on the frontend folder
sudo chown -R www-data:www-data /home/aman/wagen_chat/frontend
sudo chmod -R 755 /home/aman/wagen_chat/frontend



=============
Database
=============
psql -U wagen_chat -d wagen_chat -h localhost -W
pass: wagen_chat123
\dt

\d area

SELECT * FROM area LIMIT 10;

* To delete the row where the column name has the value feature_3
DELETE FROM area WHERE name = 'feature_3';
error: 
wagen_global=# DELETE FROM area WHERE name = 'feature_3';
ERROR:  update or delete on table "area" violates foreign key constraint "taskhistory_area_id_d4e4656e_fk_area_id" on table "taskhistory"
DETAIL:  Key (id)=(6) is still referenced from table "taskhistory".
wagen_global=# 


* Delete related rows in taskhistory
DELETE FROM taskhistory WHERE area_id = 21;

DELETE FROM area WHERE name = 'wagen_wagen_global_4D4C2';


* length of table area
SELECT COUNT(*) FROM area;

* size of table
SELECT pg_size_pretty(pg_total_relation_size('area'));

* Get the size of the entire wagen_global database
SELECT pg_size_pretty(pg_database_size('wagen_global'));

* Get the size of each table in the wagen_global database:
SELECT 
    table_name, 
    pg_size_pretty(pg_total_relation_size(table_name::regclass)) AS total_size
FROM 
    information_schema.tables
WHERE 
    table_schema = 'public'
ORDER BY 
    pg_total_relation_size(table_name::regclass) DESC;







.. Delete Database
* Terminate 
sudo -u postgres psql

* Terminate connections to the database:
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'wagen_chat';

* Drop the database: 
DROP DATABASE IF EXISTS wagen_chat;


* Drop the user:
DROP USER IF EXISTS wagen_chat;

* Exit 
\q


* Confirm Everything is Gone 
# List all databases
sudo -u postgres psql -c "\l"

# List all users
sudo -u postgres psql -c "\du"



=============
Possible errors
=============


# Check the socket file permissions after starting uWSGI:
`tail -f /home/aman/wagen_global/webapp/wagen_global/log/wagen_global.log`
`sudo tail -f /home/aman/wagen_global/webapp/wagen_global/log/wagen_global.log`

# If permission errors occurred

sudo chown -R www-data:www-data /home/aman/wagen_global/webapp/wagen_global
sudo chown -R aman:aman /home/aman/wagen_global/webapp/wagen_global/log/
sudo chmod -R 755 /home/aman/wagen_global/webapp/wagen_global/log/


# check uWSGI log
`tail -f /home/aman/wagen_global/webapp/wagen_global/log/wagen_global.log`


# check apache log if errors
`sudo tail -f /var/log/apache2/global_error.log`

# Ensure Apache Configuration Points to Correct Socket








** check all the running uWSGI workers
`ps aux | grep uwsgi`

** Kill all the workers
`sudo killall -9 uwsgi`

sudo chown -R aman:aman /home/aman/wagen_global/webapp/wagen_global/
sudo chmod 755 /home/aman/wagen_global/webapp/wagen_global/

uwsgi --ini wagen_global.ini

tail -f /home/aman/wagen_global/webapp/wagen_global/log/wagen_global.log




.. sudo killall uwsgi: Gracefully stops all uWSGI processes.
.. sudo killall -9 uwsgi: Forcefully and immediately kills all uWSGI processes without any cleanup.