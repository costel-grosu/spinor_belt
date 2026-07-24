from http.server import HTTPServer, SimpleHTTPRequestHandler
import os
import ssl


HOST = "0.0.0.0"
PORT = 4444
CERT_FILE = "cert.pem"
KEY_FILE = "key.pem"


def main():
    missing = [path for path in (CERT_FILE, KEY_FILE) if not os.path.exists(path)]
    if missing:
        files = ", ".join(missing)
        raise SystemExit(f"Missing {files}. Copy cert.pem and key.pem into this directory first.")

    server = HTTPServer((HOST, PORT), SimpleHTTPRequestHandler)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile=CERT_FILE, keyfile=KEY_FILE)
    server.socket = context.wrap_socket(server.socket, server_side=True)

    print(f"Serving HTTPS on https://{HOST}:{PORT}/")
    print("On Quest, open https://YOUR_PC_IP:4444/")
    server.serve_forever()


if __name__ == "__main__":
    main()
