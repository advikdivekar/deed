"""Download a trained LoRA adapter from Tinker to local disk. After this, nothing here needs the internet or a Tinker key.
usage: python offline/download_adapter.py tinker://.../sampler_weights/NAME offline/adapters/NAME"""
import sys, tarfile, urllib.request
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import tinker
from train.common import load_env

path, out = sys.argv[1], Path(sys.argv[2])
load_env()
rc = tinker.ServiceClient().create_rest_client()
url = rc.get_checkpoint_archive_url_from_tinker_path(path).result().url
out.mkdir(parents=True, exist_ok=True)
tar = out / "checkpoint.tar"
urllib.request.urlretrieve(url, tar)
with tarfile.open(tar) as t: t.extractall(out, filter="data")
tar.unlink()
print("saved to", out, [p.name for p in out.iterdir()])
