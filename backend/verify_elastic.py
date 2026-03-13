import sys

sys.path.insert(0, '.')
import importlib

mod = importlib.import_module('services.elastic')
init_elasticsearch = mod.init_elasticsearch
close_elasticsearch = mod.close_elasticsearch
print('import OK')
