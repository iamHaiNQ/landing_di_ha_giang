from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import sys

class RobustHTTPHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    server = ThreadingHTTPServer(("0.0.0.0", port), RobustHTTPHandler)
    print(f"Serving HTTP on port {port} with ThreadingHTTPServer...")
    server.serve_forever()
