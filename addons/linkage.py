import socket, base64, hashlib, struct, threading

class RuinConnection:
    GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

    def __init__(self, host="127.0.0.1", port=8765):
        self.host = host
        self.port = port
        self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.conn = None
        self._ondata = None

    def start(self):
        self.server_socket.bind((self.host, self.port))
        self.server_socket.listen(1)
        print(f"RuinSocket listening on {self.host}:{self.port}")
        self.conn, addr = self.server_socket.accept()
        print("Connection from", addr)
        self._handshake(self.conn)
        # Run client loop in a background thread
        threading.Thread(target=self._listen_loop, daemon=True).start()

    def _handshake(self, conn):
        request = conn.recv(1024).decode()
        key = ""
        for line in request.split("\r\n"):
            if line.startswith("Sec-WebSocket-Key"):
                key = line.split(": ")[1]
        accept = base64.b64encode(
            hashlib.sha1((key + self.GUID).encode()).digest()
        ).decode()
        response = (
            "HTTP/1.1 101 Switching Protocols\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Accept: {accept}\r\n\r\n"
        )
        conn.send(response.encode())

    def _recv_frame(self, conn):
        first_byte, second_byte = conn.recv(2)
        opcode = first_byte & 0b00001111
        masked = second_byte & 0b10000000
        length = second_byte & 0b01111111

        if length == 126:
            length = struct.unpack(">H", conn.recv(2))[0]
        elif length == 127:
            length = struct.unpack(">Q", conn.recv(8))[0]

        if masked:
            mask = conn.recv(4)
            data = bytearray(conn.recv(length))
            for i in range(length):
                data[i] ^= mask[i % 4]
            return data.decode()
        else:
            return conn.recv(length).decode()

    def _send_frame(self, message):
        payload = message.encode()
        frame = bytearray([0b10000001])  # FIN + text frame
        length = len(payload)
        if length <= 125:
            frame.append(length)
        elif length <= 65535:
            frame.append(126)
            frame.extend(struct.pack(">H", length))
        else:
            frame.append(127)
            frame.extend(struct.pack(">Q", length))
        frame.extend(payload)
        self.conn.send(frame)

    def _listen_loop(self):
        while True:
            try:
                msg = self._recv_frame(self.conn)
                if self._ondata:
                    self._ondata(msg)  # invoke callback
            except Exception as e:
                print("Connection closed or error:", e)
                break

    # Public API
    def send(self, message):
        """Send a text message to the client."""
        self._send_frame(message)

    def ondata(self, callback):
        """Register a callback to handle incoming messages."""
        self._ondata = callback