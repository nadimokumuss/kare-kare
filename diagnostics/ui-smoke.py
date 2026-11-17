#!/usr/bin/env python3
"""Exercise the built coach's UI in an isolated headless Chrome profile.

The Chrome bridge is mocked and the page has no chess game. This checks UI
mounting/settings/layout, not Chess.com compatibility or audible TTS output.
"""
import argparse
import http.server
import json
import html
import re
import subprocess
import tempfile
import threading
from pathlib import Path

PAGE = '''<!doctype html><html lang="tr"><meta charset="utf-8"><title>Kare Kare local UI check</title><link rel="stylesheet" href="/content.css"><style>body{background:#242c27;color:#ddd;font:16px system-ui;padding:30px}#smoke-result{white-space:pre-wrap;overflow-wrap:anywhere;max-width:500px}</style><h1>Kare Kare — yerel arayüz denemesi</h1><p>Tahta ve gerçek hesap yok. Chrome köprüsü taklit ediliyor.</p><pre id="smoke-result">Bekleniyor</pre>
<script>window.fixtureErrors=[];window.saved={};window.addEventListener('error',event=>fixtureErrors.push(event.message));window.chrome=window.chrome||{};chrome.runtime={id:'ui-fixture',getManifest:()=>({version:'__KARE_VERSION__'}),getURL:name=>'/'+name,connect(){const listeners=[];return{onMessage:{addListener:fn=>listeners.push(fn)},onDisconnect:{addListener(){}},disconnect(){},postMessage(message){if(message.type==='voices')queueMicrotask(()=>listeners.forEach(fn=>fn({type:'voices',voices:[]})))}}}};chrome.storage={local:{get:async()=>({}),set:async value=>{Object.assign(saved,value)}}};</script><script src="/content.js"></script>
<script>setTimeout(async()=>{try{const panel=document.querySelector('#kare-kare-coach');if(!panel)throw Error('Panel did not mount');panel.querySelector('.kk-menu').open=true;panel.querySelector('.kk-preferences').open=true;panel.querySelector('.kk-effect-settings').open=true;const detail=panel.querySelector('.kk-speech-detail');detail.value='all';detail.dispatchEvent(new Event('change'));const defender=panel.querySelector('[data-speech="defender"]');defender.checked=false;defender.dispatchEvent(new Event('change'));const volume=panel.querySelector('.kk-effect-volume');volume.value='0.4';volume.dispatchEvent(new Event('input'));await Promise.resolve();panel.querySelector('.kk-minimize').click();const collapsed=panel.classList.contains('kk-collapsed');panel.querySelector('.kk-minimize').click();const rect=panel.getBoundingClientRect();const result={mounted:true,speechChannels:panel.querySelectorAll('[data-speech]').length,effectChannels:panel.querySelectorAll('[data-effect]').length,speechDetail:saved.kareKarePreferencesV1?.speechDetail,defender:saved.kareKarePreferencesV1?.defender,effectVolume:saved.kareKarePreferencesV1?.effectVolume,effectsDefault:panel.querySelector('.kk-effects').checked,collapsed,withinViewport:rect.left>=0&&rect.top>=0&&rect.right<=innerWidth&&rect.bottom<=innerHeight,errors:fixtureErrors};document.querySelector('#smoke-result').textContent=JSON.stringify(result);panel.querySelector('.kk-menu').scrollTop=panel.querySelector('.kk-menu').scrollHeight}catch(error){document.querySelector('#smoke-result').textContent=JSON.stringify({error:error.message,errors:fixtureErrors})}},450)</script></html>'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chrome', default='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    parser.add_argument('--output', type=Path)
    parser.add_argument('--integration', action='store_true')
    parser.add_argument('--panel', action='store_true')
    args = parser.parse_args()
    args.integration = args.integration or args.panel
    root = Path(__file__).resolve().parents[1]
    page = (root / 'diagnostics/integration-fixture.html').read_text() if args.integration else PAGE
    if args.panel:
        page = page.replace('<script>\nwindow.fixtureErrors', '<script>\nwindow.fixturePanelTest=true;\nwindow.fixtureErrors')
    pages = [page, (root / 'diagnostics/integration-engine.html').read_text()] if args.integration else [page]
    for source in pages:
        for attrs, script in re.findall(r'<script([^>]*)>(.*?)</script>', source, re.S):
            subprocess.run(['node', '--input-type=module' if 'module' in attrs else '--input-type=commonjs', '--check'], input=script, text=True, check=True, capture_output=True)
    dist = root / 'extension/dist'
    version = json.loads((dist / 'manifest.json').read_text())['version']
    if not re.fullmatch(r'\d+\.\d+\.\d+', version):
        raise ValueError('Invalid built version')
    args.output = args.output or root / 'release' / (('panel-smoke-v' if args.panel else 'integration-smoke-v' if args.integration else 'ui-smoke-v') + version)
    args.output.mkdir(parents=True, exist_ok=True)

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path == '/play/computer':
                data, content_type = page.replace('__KARE_VERSION__', version).encode(), 'text/html; charset=utf-8'
            elif args.panel and self.path == '/panel-fixture-tests.js':
                data, content_type = (root / 'diagnostics/panel-fixture-tests.js').read_bytes(), 'text/javascript'
            elif args.integration and self.path in ['/chess.js', '/engine.html']:
                file = root / ('node_modules/chess.js/dist/esm/chess.js' if self.path == '/chess.js' else 'diagnostics/integration-engine.html')
                data = file.read_bytes()
                content_type = 'text/javascript' if self.path.endswith('.js') else 'text/html'
            elif self.path in ['/content.js', '/content.css']:
                data = (dist / self.path[1:]).read_bytes()
                content_type = 'text/javascript' if self.path.endswith('.js') else 'text/css'
            else:
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *_):
            pass

    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with tempfile.TemporaryDirectory(prefix='kare-ui-profile-') as profile:
            command = [args.chrome, '--headless=new', '--disable-gpu', '--disable-background-networking', '--disable-component-update',
                       '--disable-sync', '--no-first-run', '--no-default-browser-check', '--user-data-dir=' + profile,
                       '--window-size=1280,1000', '--virtual-time-budget=' + ('60000' if args.integration else '1500'), '--dump-dom',
                       '--screenshot=' + str((args.output / 'panel.png').resolve()), f'http://127.0.0.1:{server.server_port}/play/computer']
            process = subprocess.run(command, capture_output=True, text=True, timeout=85)
            if process.returncode:
                raise RuntimeError('Headless Chrome failed: ' + process.stderr[-800:])
            (args.output / 'page.html').write_text(process.stdout)
            (args.output / 'chrome.log').write_text(process.stderr)
            result_id = 'integration-result' if args.integration else 'smoke-result'
            match = re.search(r'<pre id="' + result_id + r'">(.*?)</pre>', process.stdout, re.S)
            result = json.loads(html.unescape(match[1])) if match and match[1] != 'Bekleniyor' else {'error': 'UI result missing or unfinished'}
            (args.output / 'result.json').write_text(json.dumps(result, indent=2))
            if args.panel:
                assert result.get('passed') and result.get('rankColors') and result.get('speechArrows') and not result.get('errors'), result
                print(json.dumps(result))
                return
            if args.integration:
                assert result.get('passed') and result.get('identicalBotGames') == 20 and result.get('reloadDeduplicated') and not result.get('errors'), result
                print(json.dumps(result))
                return
            assert result.get('mounted') and result.get('speechChannels') == 10 and result.get('effectChannels') == 4, result
            assert result.get('speechDetail') == 'all' and result.get('defender') is False and result.get('effectVolume') == 0.4, result
            assert result.get('effectsDefault') is False and result.get('collapsed') and result.get('withinViewport') and not result.get('errors'), result
            print(json.dumps(result))
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
