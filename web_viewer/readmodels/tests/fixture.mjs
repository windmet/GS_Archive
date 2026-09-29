/** Synthetic contract fixture; no counts, titles, bytes or timings here describe the real GS corpus. */
export function fixture({ cards = 3, padding = 32, idols = 2 } = {}) {
  const identities = Array.from({ length: idols }, (_, i) => ({ id: `fixture-${i}`, name: `Fixture ${i}`, unitName: 'Synthetic', color: '#555' }));
  return {
    identities,
    home: identities.map((person, i) => ({ ...person, costumes: [], cues: [{ id: `cue-${i}`, cue: `cue-${i}`, cardId: `card-${i}`, cardTitle:'Fixture card', modelId:'fixture-model',
      voice:'fixture.m4a', previewStep:{step_id:7, type:'adv',state:{bg:'fixture'},dialogue:{text:'fixture'}} }] })),
    homeStats:[{label:'偶像',value:idols}], homeHighlights:[{id:'event-fixture',title:'Fixture event',bannerUrl:'/assets/fixture.png'}],
    cards: Array.from({ length: cards }, (_, i) => ({ resource_id: `card-${i}`, card_id: i + 1, character_id: identities[i % identities.length].id,
      rarity:'SSR', title:`Fixture card ${i}`, voice_base:`voice-${i}`, single_state: false, texts:{normal:'x'.repeat(padding)},
      home_voice_cues:[{cue:`cue-${i}`,preview:{preview_step:{state:{bg:'fixture'},dialogue:{voice:`v-${i}`}}}}], scenario_entries:[] })),
    stories: [{ id:'story:fixture', file:'fixture.json', title:'Fixture story', domain:'main', domainLabel:'主线剧情', exists:true, resourceIds:['fixture'],
      characters:[], releaseAt:NaN, playableStartIndex:6, playableStepCount:8, searchText:'fixture story', summary:{step_count:8}, episodes:[{episode_file:'episodes/fixture.json', local_playable_start_index:3, step_count:8}] }],
    storyCatalogView:{ mainDomain:{collections:[{id:'main:fixture'}]}, extraDomain:{collections:[]}, birthdayDomain:{collections:[]}, seasonalCount:4, workCount:49 },
    songs: [{ song_code:'fixture', song_id:1, title:'Fixture song', kana:'fixture',variant_kind:'primary',audio_form:'layered',jacket_url:'/assets/songs/fixture.png',movies:[],variants:[] }],
    songSummary:{primary_songs:1}, playback:{fixture:{url:'/assets/fixture.m4a'}}, experimental:{},
    gashas:[{id:'gasha-fixture',phase:'primary',display_name:'Fixture gasha',category:'standard_pickup'}],
    extraDomains:{ events:{records:[{id:'event-fixture',summary:{name:'Fixture event'},view:{story_chapter_id:'event-fixture'}}]} },
  };
}
