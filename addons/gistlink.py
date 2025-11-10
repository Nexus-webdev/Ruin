# gistlink.py
import urllib.request
import json

class GistChannel:
    def __init__(self, gist_id, token, write='py-message.json', read='ruin-message.json'):
        self.gist_id = gist_id
        self.token = token
        self.filename = write
        self.filenameB = read
        self.api_url = 'https://api.github.com/gists/{}'.format(self.gist_id)
        self.headers = {
            'Authorization': 'token {}'.format(self.token),
            'User-Agent': 'GistChannel',
            'Accept': 'application/vnd.github.v3+json'
        }

    def _request(self, method, data=None):
        req = urllib.request.Request(self.api_url, method=method)
        for k, v in self.headers.items():
            req.add_header(k, v)
        if data:
            body = json.dumps(data).encode('utf-8')
            req.data = body
            req.add_header('Content-Type', 'application/json')
        try:
            with urllib.request.urlopen(req) as res:
                return json.loads(res.read().decode('utf-8'))
        except Exception as e:
            print('Error:', e)
            return None

    def send(self, payload):
        return self._request('PATCH', {
            'files': {
                self.filename: {
                    'content': json.dumps(payload, indent=2)
                }
            }
        })

    def receive(self):
        gist = self._request('GET')
        if not gist: return None
        content = gist.get('files', {}).get(self.filenameB, {}).get('content', '{}')
        try:
            return json.loads(content)
        except:
            return None

    def watch(self, callback, interval=0.5):
        import time
        last = None
        while True:
            msg = self.receive()
            if msg and msg != last:
                callback(msg)
                last = msg
            time.sleep(interval)