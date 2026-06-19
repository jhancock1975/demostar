#!/usr/bin/env python3
import argparse
import functools
import os
import signal
import ssl
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stdout.write("%s - %s\n" % (self.address_string(), fmt % args))
        sys.stdout.flush()


def make_server(host, port, directory, certfile=None, keyfile=None):
    handler = functools.partial(QuietHandler, directory=directory)
    server = ThreadingHTTPServer((host, port), handler)
    if certfile and keyfile:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(certfile=certfile, keyfile=keyfile)
        server.socket = context.wrap_socket(server.socket, server_side=True)
    return server


def serve(server, label, url):
    print(f"{label}: {url}", flush=True)
    server.serve_forever()


def main():
    parser = argparse.ArgumentParser(description="Serve Demostar Sensorium on the local network.")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--app-port", type=int, default=8443)
    parser.add_argument("--cert-port", type=int, default=8001)
    parser.add_argument("--app-dir", default=os.getcwd())
    parser.add_argument("--cert-dir", default="")
    parser.add_argument("--cert", required=True)
    parser.add_argument("--key", required=True)
    parser.add_argument("--lan-ip", default="")
    args = parser.parse_args()

    app_url_host = args.lan_ip or "localhost"
    servers = []
    app_server = make_server(args.host, args.app_port, args.app_dir, args.cert, args.key)
    servers.append(app_server)

    threads = [
        threading.Thread(
            target=serve,
            args=(app_server, "HTTPS app", f"https://{app_url_host}:{args.app_port}/"),
            daemon=True,
        )
    ]

    if args.cert_dir:
        cert_server = make_server(args.host, args.cert_port, args.cert_dir)
        servers.append(cert_server)
        threads.append(
            threading.Thread(
                target=serve,
                args=(cert_server, "HTTP certificate files", f"http://{app_url_host}:{args.cert_port}/"),
                daemon=True,
            )
        )

    def shutdown(_signum=None, _frame=None):
        for server in servers:
            server.shutdown()

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()


if __name__ == "__main__":
    main()
