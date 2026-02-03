
import time
from datetime import date
from django.conf import settings
from django.core.mail import EmailMessage, send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.http import JsonResponse, Http404, HttpResponse
from .models import User
import jwt
from django.utils.timezone import now
from django.core.mail import EmailMultiAlternatives
from bs4 import BeautifulSoup
import jinja2
from weasyprint import HTML
import os
import pandas as pd


def validate_jwt_request(request):
    """Check JWT in Authorization header and return (user, error_response)."""
    auth_header = request.headers.get("Authorization")


    if not auth_header or not auth_header.startswith("Token "):
        return None, JsonResponse({"success": False, "message": "Authorization header missing"}, status=401)

    token = auth_header.split(" ")[1]

    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("user_id")

        try:
            user = User.objects.get(id=user_id, is_active=True)
        except User.DoesNotExist:
            return None, JsonResponse({"success": False, "message": "Unauthorized or User not found"}, status=401)

        return user, None

    except jwt.ExpiredSignatureError:
        return None, JsonResponse({"success": False, "message": "Token expired"}, status=401)
    except jwt.InvalidTokenError:
        return None, JsonResponse({"success": False, "message": "Invalid token"}, status=401)
    

# def validate_jwt_request(request):
#     auth_header = request.headers.get("Authorization")
#     if not auth_header or not auth_header.startswith("Token "):
#         return None, JsonResponse({"success": False, "message": "Token missing or invalid"}, status=401)
#     token_str = auth_header.split(" ")[1]


#     try:
#         # Decode token
#         payload = jwt.decode(token_str, settings.JWT_SECRET, algorithms=["HS256"])
#         user_id = payload.get("user_id")

#         try:
#             token_obj = Token.objects.get(token=token_str, is_active=True)
#         except Token.DoesNotExist:
#             return None, JsonResponse({"success": False, "message": "Token revoked or not found"}, status=401)

#         if token_obj.expires_at < now():
#             token_obj.is_active = False
#             token_obj.save()
#             return None, JsonResponse({"success": False, "message": "Token expired"}, status=401)
        
#         try:
#             user = User.objects.get(id=user_id)
#         except User.DoesNotExist:
#             return None, JsonResponse({"success": False, "message": "User not found"}, status=404)
        
#         if not user.is_active:
#             return None, JsonResponse({"success": False, "message": "User account is not activated"}, status=403)
    
#         return user, None

#     except jwt.ExpiredSignatureError:
#         return None, JsonResponse({"success": False, "message": "Token expired"}, status=401)
#     except jwt.InvalidTokenError:
#         return None, JsonResponse({"success": False, "message": "Invalid token"}, status=401)
    






def send_mail_attach(sub, mess, to, attach=None):
    try:
        email = EmailMessage(
            subject=sub,
            body=mess,
            from_email=settings.EMAIL_ADDR,
            to=[to],
        )
        if attach:
            email.attach_file(attach)
        email.send()
    except Exception as e:
        # Check if error is related to message sending quota exceeded
        if hasattr(e, 'args') and e.args and e.args[0] == 551 and 'message sending quota exceeded' in e.args[1]:
            time.sleep(120)  # Wait for 2 minutes before retrying
            send_mail_attach(sub, mess, to, attach)
        else:
            return {"result": f"There was an error sending email to {to}",
                    "error": str(e)}
    return {"result": f"Email sent to {to}", "status": "success"}





def send_otp(user_email, otp):
    subject = "Your OTP for Email Verification"
    from_email = settings.EMAIL_HOST_USER
    to_email = [user_email]
    print("user_email",user_email)
    print("otp",otp)

    # HTML body
    html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; padding: 20px;">
          <h2 style="color: #1e3a8a; text-align: center;"> Email Verification</h2>
          <p>Hi <strong>{user_email}</strong>,</p>
          <p>Your verification code is:</p>
          <h1 style="font-size: 32px; letter-spacing: 6px; background-color: #f4f4f4; padding: 12px; text-align: center; border-radius: 5px;">
            {otp}
          </h1>
          <p>This code will expire in <strong>10 minutes</strong>.</p>
          <p>Thank you</p>
        </div>
    """

    try:
        email = EmailMultiAlternatives(subject, "", from_email, to_email)
        email.attach_alternative(html_content, "text/html")
        email.send(fail_silently=False)
        return {"result": "OTP sent successfully.", "status": "success"}
    except Exception as e:
        return {"result": "Failed to send OTP.", "status": "error", "error": str(e)}







def send_contact_email(username, user_email, usermessage):
    subject = "Contact Form Submission – eToolkit"
    from_email = settings.EMAIL_HOST_USER
    to_email = [settings.ADMIN_EMAIL]

    # Email body content
    body_template = f"""
    You have received a new contact form submission:

    Name: {username}
    Email: {user_email}
    Message:
    {usermessage}

    Best regards,  
    eToolkit
        """

    try:
        email = EmailMessage(
            subject=subject,
            body=body_template,
            from_email=from_email,
            to=to_email,
            reply_to=[user_email]
        )
        email.send()
        return {"result": "Message sent successfully.", "status": "success"}
    except Exception as e:
        return {"result": "Failed to send message.", "status": "error", "error": str(e)}
    




def render_prod_html(jobid, area, stats):
    """Render html page using jinja"""
    template_loader = jinja2.FileSystemLoader(searchpath=os.path.join(settings.BASE_DIR, 'webapp', "templates"))
    template_env = jinja2.Environment(loader=template_loader)
    template_file = "report_custom_wb.html"
    template = template_env.get_template(template_file)
    output_text = template.render(area=area.name, settings=settings, job=jobid, stats=stats)
    html_path = os.path.join(settings.MEDIA_ROOT, jobid, 'index.html')
    with open(html_path, 'w') as html_file:
        html_file.write(output_text)
    return html_path


def render_pdf_html(jobid, area, stats,wri_data):
    """Render HTML page using Django templates"""
    template_loader = jinja2.FileSystemLoader(searchpath=os.path.join(settings.BASE_DIR, 'webapp', "templates"))
    template_env = jinja2.Environment(loader=template_loader)
    if wri_data=='true':
        template_file = "report_custom_wri_pdf.html"
    else:
        template_file = "report_custom_pdf.html"

    template = template_env.get_template(template_file)

    base_url = settings.BASE_URL
    output_text = template.render(area=area.name, settings=settings, job=jobid, stats=stats, base_url=base_url)
    html_path = os.path.join(settings.MEDIA_ROOT, jobid, 'report1.html')
    with open(html_path, 'w') as html_file:
        html_file.write(output_text)
    return html_path


def render_pdf(htmlfile2, jobid):
    """Render pdf page from html using weasyprint"""
    table1path = os.path.join(settings.MEDIA_ROOT, jobid, 'Table1.csv')
    table2path = os.path.join(settings.MEDIA_ROOT, jobid, 'Table2.csv')
    table3path = os.path.join(settings.MEDIA_ROOT, jobid, 'Table3.csv')
    table4path = os.path.join(settings.BASE_DIR, 'webapp/static/data', 'datasource.csv')
    df_table_1 = pd.read_csv(table1path)
    df_table_2 = pd.read_csv(table2path)
    df_table_3 = pd.read_csv(table3path)
    df_table_4 = pd.read_csv(table4path)
    # Replace blank headers with empty strings
    df_table_1.columns = [col if not col.startswith('Unnamed') else '' for col in df_table_1.columns]
    df_table_2.columns = [col if not col.startswith('Unnamed') else '' for col in df_table_2.columns]
    df_table_3.columns = [col if not col.startswith('Unnamed') else '' for col in df_table_3.columns]
    df_table_4.columns = [col if not col.startswith('Unnamed') else '' for col in df_table_4.columns]
    # Convert the DataFrames to HTML tables with specified class and ID
    html_table_1 = df_table_1.to_html(index=False, classes='table table-bordered table-responsive', table_id='csv1Root', na_rep='')
    html_table_2 = df_table_2.to_html(index=False, classes='table table-bordered table-responsive', table_id='csv2Root', na_rep='')
    html_table_3 = df_table_3.to_html(index=False, classes='table table-bordered table-responsive', table_id='csv3Root', na_rep='')
    html_table_4 = df_table_4.to_html(index=False, classes='table table-bordered table-responsive', table_id='csv6Root', na_rep='')


    with open(htmlfile2, 'r') as file:
        soup = BeautifulSoup(file, 'html.parser')

    # Find the table elements by their IDs
    table_element_1 = soup.find('table', {'id': 'csv1Root'})
    table_element_2 = soup.find('table', {'id': 'csv2Root'})
    table_element_3 = soup.find('table', {'id': 'csv3Root'})
    table_element_4 = soup.find('table', {'id': 'csv6Root'})


    # Replace the table content with the new HTML tables
    table_element_1.replace_with(BeautifulSoup(html_table_1, 'html.parser'))
    table_element_2.replace_with(BeautifulSoup(html_table_2, 'html.parser'))
    table_element_3.replace_with(BeautifulSoup(html_table_3, 'html.parser'))
    table_element_4.replace_with(BeautifulSoup(html_table_4, 'html.parser'))

    # Write the modified HTML back to the file
    report2path = os.path.join(settings.MEDIA_ROOT, jobid, 'report2.html')
    with open(report2path, 'w') as file:
        file.write(str(soup))

    reportpdfpath = os.path.join(settings.MEDIA_ROOT, jobid, 'report.pdf')
    HTML(report2path, base_url=settings.BASE_DIR).write_pdf(reportpdfpath)
    # HTML(report2path).write_pdf(reportpdfpath)
    return reportpdfpath

""" def render_pdf(html, jobid):
    with open(html) as inhtml:
        htmlstr = inhtml.read()
    # replace img to embed because they work really better in weasyprint
    htmlstr = htmlstr.replace("img", "embed")
    
    mystatic = "{ut}://{ba}{st}".format(ut=settings.HTTP_TYPE,
                                        ba=Site.objects.get_current().domain,
                                        st=os.path.join(settings.STATIC_URL))
    mymedia = "{ut}://{ba}{me}".format(ut=settings.HTTP_TYPE,
                                       ba=Site.objects.get_current().domain,
                                       me=os.path.join(settings.MEDIA_URL))
    htmlstr = htmlstr.replace("/static/", mystatic)
    htmlstr = htmlstr.replace("/media/", mymedia)
    with open("{}.new".format(html), 'w') as outhtml:
        outhtml.write(htmlstr)
    pdf = HTML(string=htmlstr).write_pdf()
    pdf_path = os.path.join(settings.MEDIA_ROOT, jobid, 'report.pdf')
    with open(pdf_path, 'wb') as pdf_file:
        pdf_file.write(pdf)
    return pdf_path """
    




def remove_z_from_geojson(coordinates):
    """
    Recursively remove the third (z) element from coordinate arrays.
    Works for both lists and tuples.
    """
    if isinstance(coordinates, (list, tuple)):
        # If the coordinate is a flat sequence of numbers:
        if coordinates and isinstance(coordinates[0], (int, float)):
            # Convert to list to be safe and remove the third element if present.
            coord_list = list(coordinates)
            return coord_list[:2] if len(coord_list) >= 3 else coord_list
        else:
            # Otherwise, recursively process each coordinate
            return [remove_z_from_geojson(coord) for coord in coordinates]
    return coordinates
