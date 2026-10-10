#!/usr/bin/env python3
"""Add one exact product definition without changing collector or page code."""
import argparse
import json
from pathlib import Path
from model import validate_catalog
from update_prices import DATA, read, write


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['add'])
    parser.add_argument('file',type=Path)
    args=parser.parse_args()
    catalog=read(DATA/'catalog.json',{})
    product=json.loads(args.file.read_text())
    for field in ('id','name','variant','pack_count','price_bounds_cents','mappings'):
        if field not in product:
            parser.error('Product missing '+field)
    if not any(product.get(k) for k in ('size_ml','size_g','size_label')):
        parser.error('Product needs a pack size')
    catalog['products'].append(product)
    try:
        validate_catalog(catalog)
    except (ValueError,KeyError,TypeError) as exc:
        parser.error(str(exc))
    write(DATA/'catalog.json',catalog)
    print('Added '+product['id']+'. Verify its retailer mappings before relying on observations.')

if __name__=='__main__':
    main()
