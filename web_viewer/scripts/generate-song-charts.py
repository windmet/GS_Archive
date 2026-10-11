#!/usr/bin/env python3
import argparse, json, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'data_pipeline'))
from archive_paths import add_sources_config_argument, load_archive_sources
from song_gameplay import ROOT, generate_charts

parser=argparse.ArgumentParser(description='Partition original SideM fumen; no media copying')
add_sources_config_argument(parser)
parser.add_argument('--check',action='store_true')
args=parser.parse_args()
sources=load_archive_sources(args.sources_config)
codes=json.loads((ROOT/'public/data/masterdata/music_catalog.json').read_text(encoding='utf-8'))['songs']
generate_charts(sources.raw_root/'asset',codes,args.check)
