# gistlink.py
import requests
import json
import time
from typing import Callable, Optional

class GistChannel:
    def __init__(self, gist_id: str, token: str, write: str = "py-message.json", read: str = "ruin-message.json"):
        self.gist_id = gist_id
        self.token = token
        self.filename = write
        self.filenameB = read
        self.headers = {
            "Authorization": f"token {self.token}",
            "Accept": "application/vnd.github.v3+json"
        }

    def receive(self) -> Optional[dict]:
        url = f"https://api.github.com/gists/{self.gist_id}"
        res = requests.get(url, headers=self.headers)
        if res.status_code != 200:
            return None
        content = res.json()["files"].get(self.filenameB, {}).get("content", "{}")
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            return None

    def send(self, data: dict) -> bool:
        url = f"https://api.github.com/gists/{self.gist_id}"
        payload = {
            "files": {
                self.filename: {
                    "content": json.dumps(data, indent=2)
                }
            }
        }
        res = requests.patch(url, headers=self.headers, json=payload)
        return res.status_code == 200

    def watch(self, callback: Callable[[dict], None], interval: float = 5.0):
        last = None
        while True:
            msg = self.receive()
            if msg and msg != last:
                callback(msg)
                last = msg
            time.sleep(interval)