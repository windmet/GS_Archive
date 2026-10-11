"""Read command input, select a generation job, and write its outputs."""
from __future__ import annotations

from argparse import Namespace
import hashlib
from .generation_inputs import GenerationInputs
from .generation_jobs import SELECTED_JOBS, generate_full
from .output_io import write_json_outputs, FULL_PUBLIC_OUTPUTS
from .wire import decode_masterdata_input, iter_top_records
from .archive_domain_job import public_domain_names


def run(args: Namespace) -> None:
    args.out_dir.mkdir(parents=True, exist_ok=True)
    decoded = decode_masterdata_input(args.input.read_bytes(), args.input_state)
    decoded_path = args.out_dir / "client_master_data.xor_DefaultPassPhrase.pb"
    decoded_path.write_bytes(decoded)
    inputs = GenerationInputs(
        records=list(iter_top_records(decoded)),
        compiled_dir=args.compiled_dir, voice_dir=args.voice_dir,
        spines_index=args.spines_index, prefab_meta=args.prefab_meta, bg_dir=args.bg_dir,
        curated_card_voices=args.curated_card_voices, curated_gasha_titles=args.curated_gasha_titles,
        decoded_sha256=hashlib.sha256(decoded).hexdigest(),
    )
    mode = next((name for name in SELECTED_JOBS if getattr(args, name + "_only")), "full")
    job = generate_full if mode == "full" else SELECTED_JOBS[mode]
    outputs = job(inputs)
    public_names = FULL_PUBLIC_OUTPUTS if mode == "full" else public_domain_names(outputs) if mode == 'archive_domains' else None
    write_json_outputs(outputs, args.out_dir, args.public_out_dir, public_names)
    print(f"decoded: {decoded_path}")
    if mode == 'archive_domains':
        print(f"archive domains: {outputs['validation_report.json']['stats']}")
        print(f"public whitelist: {len(public_names)} artifacts; raw audit outputs excluded")
        return
    for filename, data in outputs.items():
        if mode == "full":
            count = len(data) if isinstance(data, (list, dict)) else 1
            print(f"{filename}: {count} records")
        elif mode == "seasonal_campaign":
            print(f"{filename}: {len(data['campaigns'])} campaigns")
        elif mode == "work_story":
            print(f"{filename}: {len(data['idols'])} idols")
        else:
            print(f"{filename}: {data.get('meta', {})}")
