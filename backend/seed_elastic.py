"""
Elasticsearch demo data seeding script for Echo.

Populates echo-thoughts and echo-resolutions indices with realistic humanised
thoughts and resolution texts for demo purposes.

Usage:
    python seed_elastic.py              # Seed if not already seeded
    python seed_elastic.py --force      # Wipe and reseed
    python seed_elastic.py --dry-run    # Preview without connecting

PRIVACY: This script only indexes anonymized/humanized content.
No raw thoughts, no user IDs, no account linkage.
"""

import argparse
import random
import sys
import uuid
from datetime import date, timedelta
from typing import Any

import numpy as np
from elasticsearch import Elasticsearch, NotFoundError
from elasticsearch.helpers import bulk

from config import config
from seed_data import RESOLUTIONS, THOUGHTS_BY_THEME


# ── Constants ────────────────────────────────────────────────────────────────

VECTOR_DIMS = 1536

# Each theme gets a reproducible centroid so same-theme thoughts cluster together
_THEME_CENTROIDS: dict[str, np.ndarray] = {}

# Weekly distribution weights: index 0 = current week, 7 = oldest
# Current week gets the most entries for impressive aggregate counts
_WEEK_WEIGHTS = [40, 20, 13, 9, 7, 5, 4, 2]

# Index mappings mirror services/elastic.py
_THOUGHTS_INDEX_MAPPING: dict[str, Any] = {
    "mappings": {
        "properties": {
            "message_id": {"type": "keyword"},
            "humanised_text": {"type": "text"},
            "theme_category": {"type": "keyword"},
            "sentiment_vector": {
                "type": "dense_vector",
                "dims": VECTOR_DIMS,
                "index": True,
                "similarity": "cosine",
            },
            "timestamp_week": {"type": "keyword"},
            "has_resolution": {"type": "boolean"},
        }
    }
}

_RESOLUTIONS_INDEX_MAPPING: dict[str, Any] = {
    "mappings": {
        "properties": {
            "resolution_id": {"type": "keyword"},
            "message_id": {"type": "keyword"},
            "resolution_text": {"type": "text"},
            "theme_category": {"type": "keyword"},
            "timestamp_week": {"type": "keyword"},
        }
    }
}


# ── Vector generation ─────────────────────────────────────────────────────────

def _get_theme_centroid(theme: str) -> np.ndarray:
    """
    Return a reproducible unit-norm centroid vector for the given theme.

    Same theme always produces the same centroid so vectors are stable
    across script runs.
    """
    if theme not in _THEME_CENTROIDS:
        rng = np.random.default_rng(seed=abs(hash(theme)) % (2 ** 32))
        centroid = rng.standard_normal(VECTOR_DIMS).astype(np.float32)
        centroid /= np.linalg.norm(centroid)
        _THEME_CENTROIDS[theme] = centroid
    return _THEME_CENTROIDS[theme]


def _generate_sentiment_vector(theme: str, noise_scale: float = 0.15) -> list[float]:
    """
    Generate a 1536-dim vector near the theme centroid with gaussian noise.

    Thoughts within the same theme cluster together in vector space, enabling
    meaningful kNN semantic search results in the demo.

    Args:
        theme: Theme category string.
        noise_scale: Standard deviation of gaussian noise added to centroid.

    Returns:
        List of 1536 floats (unit-normalised).
    """
    centroid = _get_theme_centroid(theme)
    noise = np.random.standard_normal(VECTOR_DIMS).astype(np.float32) * noise_scale
    vector = centroid + noise
    vector /= np.linalg.norm(vector)
    return vector.tolist()


# ── Timestamp helpers ─────────────────────────────────────────────────────────

def _iso_week_string(weeks_ago: int) -> str:
    """
    Return ISO week string (YYYY-Www) for N weeks before today.

    Args:
        weeks_ago: 0 = current week, 7 = 7 weeks ago.

    Returns:
        e.g. "2026-W10"
    """
    target = date.today() - timedelta(weeks=weeks_ago)
    iso = target.isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"


def _distribute_across_weeks(total: int) -> list[tuple[int, int]]:
    """
    Distribute total count across 8 weeks according to _WEEK_WEIGHTS.

    Returns:
        List of (weeks_ago, count) tuples, most-recent first.
    """
    total_weight = sum(_WEEK_WEIGHTS)
    distribution: list[tuple[int, int]] = []
    allocated = 0

    for i, weight in enumerate(_WEEK_WEIGHTS):
        if i == len(_WEEK_WEIGHTS) - 1:
            count = total - allocated
        else:
            count = round(total * weight / total_weight)
        if count > 0:
            distribution.append((i, count))
        allocated += count

    return distribution


# ── Index management ──────────────────────────────────────────────────────────

def _ensure_index(
    client: Elasticsearch,
    index_name: str,
    mapping: dict[str, Any],
    force: bool,
) -> None:
    """
    Create index with mapping if it does not exist, or delete and recreate if force=True.

    Args:
        client: Synchronous Elasticsearch client.
        index_name: Name of the index.
        mapping: Index mapping body.
        force: If True, delete existing index and recreate.
    """
    exists = client.indices.exists(index=index_name)

    if exists and force:
        client.indices.delete(index=index_name)
        print(f"  Deleted existing index: {index_name}")
        exists = False

    if not exists:
        client.indices.create(index=index_name, body=mapping)
        print(f"  Created index: {index_name}")
    else:
        print(f"  Index already exists: {index_name}")


def _count_documents(client: Elasticsearch, index_name: str) -> int:
    """Return document count for an index, or 0 if index does not exist."""
    try:
        response = client.count(index=index_name)
        return int(response.get("count", 0))
    except Exception:
        return 0


# ── Document builders ─────────────────────────────────────────────────────────

def _build_thought_action(
    message_id: str,
    text: str,
    theme: str,
    weeks_ago: int,
    has_resolution: bool,
    index_name: str,
) -> dict[str, Any]:
    """Build an Elasticsearch bulk action for a thought document."""
    return {
        "_index": index_name,
        "_id": message_id,
        "_source": {
            "message_id": message_id,
            "humanised_text": text,
            "theme_category": theme,
            "sentiment_vector": _generate_sentiment_vector(theme),
            "timestamp_week": _iso_week_string(weeks_ago),
            "has_resolution": has_resolution,
        },
    }


def _build_resolution_action(
    resolution_id: str,
    message_id: str,
    resolution_text: str,
    theme: str,
    weeks_ago: int,
    index_name: str,
) -> dict[str, Any]:
    """Build an Elasticsearch bulk action for a resolution document."""
    return {
        "_index": index_name,
        "_id": resolution_id,
        "_source": {
            "resolution_id": resolution_id,
            "message_id": message_id,
            "resolution_text": resolution_text,
            "theme_category": theme,
            "timestamp_week": _iso_week_string(weeks_ago),
        },
    }


# ── Core seeding logic ────────────────────────────────────────────────────────

def _build_all_actions(
    thoughts_index: str,
    resolutions_index: str,
) -> tuple[list[dict[str, Any]], int, int]:
    """
    Build all bulk actions for thoughts and resolutions.

    Returns:
        Tuple of (actions, thought_count, resolution_count).
    """
    actions: list[dict[str, Any]] = []
    thought_count = 0
    resolution_count = 0

    for theme, texts in THOUGHTS_BY_THEME.items():
        theme_resolutions = RESOLUTIONS.get(theme, {})
        distribution = _distribute_across_weeks(len(texts))

        text_index = 0
        for weeks_ago, count in distribution:
            for _ in range(count):
                if text_index >= len(texts):
                    break

                thought_text = texts[text_index]
                resolution_text = theme_resolutions.get(text_index)
                has_resolution = resolution_text is not None
                message_id = str(uuid.uuid4())

                actions.append(
                    _build_thought_action(
                        message_id=message_id,
                        text=thought_text,
                        theme=theme,
                        weeks_ago=weeks_ago,
                        has_resolution=has_resolution,
                        index_name=thoughts_index,
                    )
                )
                thought_count += 1

                if has_resolution:
                    resolution_id = str(uuid.uuid4())
                    actions.append(
                        _build_resolution_action(
                            resolution_id=resolution_id,
                            message_id=message_id,
                            resolution_text=resolution_text,
                            theme=theme,
                            weeks_ago=weeks_ago,
                            index_name=resolutions_index,
                        )
                    )
                    resolution_count += 1

                text_index += 1

    return actions, thought_count, resolution_count


def seed(client: Elasticsearch, force: bool) -> None:
    """
    Seed Elasticsearch with demo thoughts and resolutions.

    Args:
        client: Synchronous Elasticsearch client.
        force: If True, wipe existing data and reseed.
    """
    thoughts_index = config.ELASTIC_THOUGHTS_INDEX
    resolutions_index = config.ELASTIC_RESOLUTIONS_INDEX

    print("\n[1/4] Setting up indices...")
    _ensure_index(client, thoughts_index, _THOUGHTS_INDEX_MAPPING, force)
    _ensure_index(client, resolutions_index, _RESOLUTIONS_INDEX_MAPPING, force)

    # Idempotency check — skip if already seeded and not forcing
    if not force:
        existing_count = _count_documents(client, thoughts_index)
        if existing_count > 0:
            print(
                f"\n  Index '{thoughts_index}' already contains {existing_count} documents."
            )
            print("  Run with --force to wipe and reseed.")
            return

    print("\n[2/4] Building documents...")
    random.seed(42)
    np.random.seed(42)

    actions, thought_count, resolution_count = _build_all_actions(
        thoughts_index, resolutions_index
    )

    print(f"  Prepared {thought_count} thoughts and {resolution_count} resolutions")

    print("\n[3/4] Bulk indexing...")
    success_count, errors = bulk(
        client,
        actions,
        chunk_size=200,
        request_timeout=60,
        raise_on_error=False,
    )

    if errors:
        print(f"  WARNING: {len(errors)} bulk errors occurred")
        for err in errors[:3]:
            print(f"    {err}")

    print(f"  Indexed {success_count} documents successfully")

    print("\n[4/4] Summary statistics:")
    client.indices.refresh(index=thoughts_index)
    client.indices.refresh(index=resolutions_index)

    final_thoughts = _count_documents(client, thoughts_index)
    final_resolutions = _count_documents(client, resolutions_index)

    print(f"  echo-thoughts:    {final_thoughts} documents")
    print(f"  echo-resolutions: {final_resolutions} documents")

    # Per-theme breakdown
    theme_agg = client.search(
        index=thoughts_index,
        body={
            "size": 0,
            "aggs": {
                "themes": {
                    "terms": {"field": "theme_category", "size": 20}
                }
            },
        },
    )
    buckets = (
        theme_agg.get("aggregations", {}).get("themes", {}).get("buckets", [])
    )
    if buckets:
        print("\n  Theme distribution:")
        for bucket in sorted(buckets, key=lambda b: -b["doc_count"]):
            bar = "█" * min(40, bucket["doc_count"] // 2)
            print(f"    {bucket['key']:<25} {bucket['doc_count']:>4}  {bar}")

    current_week = _iso_week_string(0)
    week_agg = client.search(
        index=thoughts_index,
        body={
            "size": 0,
            "query": {"term": {"timestamp_week": current_week}},
            "aggs": {
                "themes": {
                    "terms": {"field": "theme_category", "size": 20}
                }
            },
        },
    )
    week_buckets = (
        week_agg.get("aggregations", {}).get("themes", {}).get("buckets", [])
    )
    total_this_week = sum(b["doc_count"] for b in week_buckets)
    print(f"\n  This week ({current_week}): {total_this_week} thoughts across {len(week_buckets)} themes")
    print("\n  Seeding complete.")


def dry_run() -> None:
    """
    Preview seeding plan without connecting to Elasticsearch.
    """
    print("\n[DRY RUN] Would seed the following data:")

    random.seed(42)
    np.random.seed(42)

    total_thoughts = 0
    total_resolutions = 0

    for theme, texts in THOUGHTS_BY_THEME.items():
        theme_resolutions = RESOLUTIONS.get(theme, {})
        res_count = len(theme_resolutions)
        total_thoughts += len(texts)
        total_resolutions += res_count

    print(f"\n  Thoughts:    {total_thoughts}")
    print(f"  Resolutions: {total_resolutions}")
    print(f"  Themes:      {len(THOUGHTS_BY_THEME)}")
    print(f"\n  Week distribution (of {total_thoughts} total):")

    distribution = _distribute_across_weeks(total_thoughts)
    for weeks_ago, count in distribution:
        week_str = _iso_week_string(weeks_ago)
        label = "← current week" if weeks_ago == 0 else ""
        print(f"    {week_str}  {count:>4} thoughts  {label}")

    print(f"\n  Target indices:")
    print(f"    {config.ELASTIC_THOUGHTS_INDEX}")
    print(f"    {config.ELASTIC_RESOLUTIONS_INDEX}")
    print(f"\n  Would seed {total_thoughts} thoughts and {total_resolutions} resolutions")
    print("  (use without --dry-run to execute against Elasticsearch)")


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed Elasticsearch with Echo demo data"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Delete existing indices and reseed from scratch",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be seeded without connecting to Elasticsearch",
    )
    args = parser.parse_args()

    if args.dry_run:
        dry_run()
        return

    missing = config.validate()
    elastic_missing = [k for k in missing if k.startswith("ELASTIC")]
    if elastic_missing:
        print(f"ERROR: Missing Elasticsearch configuration: {elastic_missing}", file=sys.stderr)
        print("Set ELASTIC_CLOUD_ID and ELASTIC_API_KEY in your .env file.", file=sys.stderr)
        sys.exit(1)

    print("Connecting to Elasticsearch...")
    client = Elasticsearch(
        cloud_id=config.ELASTIC_CLOUD_ID,
        api_key=config.ELASTIC_API_KEY,
        request_timeout=30,
    )

    try:
        info = client.info()
        print(f"Connected to Elasticsearch cluster: {info['cluster_name']}")
    except Exception as exc:
        print(f"ERROR: Could not connect to Elasticsearch: {exc}", file=sys.stderr)
        sys.exit(1)

    seed(client, force=args.force)


if __name__ == "__main__":
    main()
