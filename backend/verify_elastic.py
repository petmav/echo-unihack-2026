import sys
sys.path.insert(0, '.')
import asyncio
import importlib

mod = importlib.import_module('services.elastic')
init_elasticsearch = getattr(mod, 'init_elasticsearch')
close_elasticsearch = getattr(mod, 'close_elasticsearch')
print('import OK')
