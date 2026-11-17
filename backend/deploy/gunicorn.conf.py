"""
Gunicorn settings for the Django API (Linux server).
Run from backend/:  .venv/bin/gunicorn -c deploy/gunicorn.conf.py config.wsgi
"""

import multiprocessing
import os

bind = os.environ.get('GUNICORN_BIND', '127.0.0.1:8000')  # nginx forwards to this
workers = int(os.environ.get('GUNICORN_WORKERS', min(4, multiprocessing.cpu_count() * 2 + 1)))
threads = 2
timeout = 60  # order placement normally takes well under a second
graceful_timeout = 30
max_requests = 1000  # recycle workers now and then
max_requests_jitter = 100
accesslog = '-'  # stdout, collected by systemd / the host
errorlog = '-'
forwarded_allow_ips = '127.0.0.1'  # trust X-Forwarded-* only from the local nginx
