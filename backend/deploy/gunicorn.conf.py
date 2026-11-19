"""
Gunicorn settings for the Django API (own Linux server or Render).
Run from backend/:  .venv/bin/gunicorn -c deploy/gunicorn.conf.py config.wsgi
"""

import multiprocessing
import os

# Own server: 127.0.0.1:8000 behind nginx. Render (and similar hosts) set PORT and route to 0.0.0.0:$PORT.
bind = os.environ.get('GUNICORN_BIND') or (f"0.0.0.0:{os.environ['PORT']}" if os.environ.get('PORT') else '127.0.0.1:8000')
workers = int(os.environ.get('GUNICORN_WORKERS', min(4, multiprocessing.cpu_count() * 2 + 1)))
threads = 2
timeout = 60  # order placement normally takes well under a second
graceful_timeout = 30
max_requests = 1000  # recycle workers now and then
max_requests_jitter = 100
accesslog = '-'  # stdout, collected by systemd / the host
errorlog = '-'
# Trust X-Forwarded-* only from the proxy in front: the local nginx (default), or on Render '*' because
# the container is reachable only through Render's own load balancer.
forwarded_allow_ips = os.environ.get('FORWARDED_ALLOW_IPS', '127.0.0.1')
