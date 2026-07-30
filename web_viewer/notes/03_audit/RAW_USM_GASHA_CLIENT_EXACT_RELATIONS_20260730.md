# RAW USM Gasha Client Exact Relations

Status: implemented on `codex/usm-gasha-client-exact-relations`

Date: 2026-07-30

## Scope

This batch promotes the 11 card-rarity movies and `ssr_motion.usm` from
filename candidates to exact client-consumer relations. It performs no media
decode, demux, transcode, copy, publication, or Runtime change.

The authority is the archived client IL2CPP metadata v27 snapshot:

```text
SHA-256 658f966af11aef965b541e093889056cafa61a7f7fcd4bbf38e1ca2eab6d6e00
bytes   12,431,328
```

The source binary stays outside Git. Its deterministic semantic extract is:

```text
public/data/client/gasha_movie_contract.json
```

## Exact client evidence

The metadata exposes:

- `Growing.Theater.GashaAnimationMovie.Setup(filePath, trimEndSeconds,
  controllType)`;
- `Growing.Theater.GashaAnimationMovieManager`;
- manager fields `_startMovieList` and `_ssrMovie`;
- manager methods `Setup(..., mostRarity, ...)`,
  `CreateAnimation(mostRarity)`, `GetProbabilityKey(dictionary)`,
  `StartAnimePlay(...)`, and `SsrAnimePlay(...)`;
- the exact literal `c0{0}_{1}.usm`;
- the exact rarity-key literals `r`, `sr`, `ssr`, `r_ssr`, and `sr_ssr`;
- the exact fixed literal `ssr_motion.usm`.

The complete mounted RAW population selected by the format/fixed-name contract
is exactly:

```text
c01_r c01_sr c01_ssr
c02_r c02_sr c02_ssr
c03_r c03_r_ssr c03_sr c03_sr_ssr c03_ssr
ssr_motion
```

There are no missing or extra `c0*`/`ssr_motion` USMs. This is a client
filename-construction relation, not a guess from the physical filenames.

## Catalog effect

The USM catalog advances to schema v5:

```text
260 total / 89 exact consumer / 166 exact masterdata / 5 unresolved
```

Each of the 12 promoted entries records:

- consumer `Growing.Theater.GashaAnimationMovieManager`;
- mapping kind `gasha-animation-movie`;
- exact resource ID and role from
  `gasha_movie_contract.resources`;
- the two format arguments for start movies, or `null` for the fixed SSR movie.

The previous schemas v1-v4 remain immutable.

## Remaining boundary

Only five physical BackMonitor-family variants remain unresolved:

```text
live_backmonitor_movie_cool_03
live_backmonitor_movie_cute_02
live_backmonitor_movie_japanese_01_2
live_backmonitor_movie_pavetl_01_2
live_backmonitor_movie_rehobe_01_2
```

None is referenced by the 119 archived choreography scripts, and no independent
client table or other consumer contract was found. They remain physical
sources with filename candidates only. Their similarity to referenced siblings
does not authorize an exact relation or derivative.

## Verification

Source-only checks validate the committed metadata identity, type/member
tokens, literal indexes, exact 12-resource population, v5 schema, and catalog
cross-references. Mounted checks regenerate the contract from the archived
metadata and compare the exact RAW population.

The long-duration Story Runtime acceptance remains deliberately deferred and
is not represented as completed by this batch.
