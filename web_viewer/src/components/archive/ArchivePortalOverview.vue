<template>
  <div class="portal-overview-scroll" data-archive-scroll-container>
      <header class="overview-toolbar">
        <div class="overview-brand">
          <button v-if="canGoBack" class="overview-icon-button" type="button" aria-label="返回来源页" data-archive-focus-id="portal-back" @click="emit('back')"><ArrowLeft :size="20" aria-hidden="true" /></button>
          <h1 id="portal-title" ref="heading" tabindex="-1">资料馆</h1>
          <!-- The view switch: the whole archive, or one idol's workbench (the saved 担当, or whoever was opened). -->
          <GsSegmented class="overview-lens" :model-value="lensValue" :options="lensOptions" aria-label="资料馆视角" @update:model-value="chooseLens">
            <template #default="{ option }"><ArchiveIdolAvatar v-if="option.code" :idol-code="option.code" :size="20" :ring-width="0" :gap="0" decorative /><span class="overview-lens-name">{{ option.label }}</span></template>
          </GsSegmented>
        </div>



      <section ref="searchPanel" class="overview-search" @keydown.esc.prevent="collapseSearch" aria-labelledby="portal-search-title">
        <h2 id="portal-search-title" class="overview-visually-hidden">搜索全站档案</h2>
        <form class="overview-search-form" role="search" @submit.prevent="searchOpen = true; setSearchCollapsed(false); emit('search', query)">
          <Search :size="21" aria-hidden="true" />
          <input id="portal-global-search" ref="searchInput" type="search" :value="query" aria-label="搜索偶像、卡片、歌曲、故事" placeholder="搜索全站档案…" autocomplete="off" aria-controls="portal-search-results" :aria-expanded="searchOpen" data-archive-focus-id="portal-search" @focus="searchOpen = true; setSearchCollapsed(false)" @input="searchOpen = true; setSearchCollapsed(false); emit('search', $event.target.value)" />
          <button v-if="query" class="overview-icon-button" type="button" aria-label="清空搜索" @click="emit('search', ''); setSearchCollapsed(false); searchOpen = false"><X :size="18" aria-hidden="true" /></button>
          <button class="overview-search-submit" type="submit">搜索</button>
        </form>

        <div v-if="searchOpen" id="portal-search-results" class="overview-search-results gs-enter-popover" role="region" aria-label="搜索结果" :aria-busy="Boolean(globalSearch.loading)">
          <button class="overview-search-collapse" type="button" aria-label="收起搜索结果" @click="collapseSearch"><X :size="16" />收起</button>
          <div v-if="quickSearchTerms.length" class="overview-search-shortcuts" aria-label="担当相关搜索"><span>相关搜索</span><button v-for="term in quickSearchTerms" :key="term" type="button" :aria-label="`搜索 ${term}`" @click="setSearchCollapsed(false); searchOpen = true; emit('search',term)">{{ term }}</button></div>
          <p v-if="globalSearch.loading" class="overview-status" role="status">正在搜索档案…</p>
          <ArchiveErrorNote v-if="globalSearch.error" class="overview-error">{{ globalSearch.error }}</ArchiveErrorNote>
          <template v-if="searchGroups.length">
            <p class="overview-search-total">匹配 {{ formatCount(searchResults.length) }} 条 · 每类展示最多 6 条</p>
            <section v-for="group in searchGroups" :key="group.domain" class="overview-result-group" :aria-labelledby="`portal-search-${group.domain}`">
              <header><h3 :id="`portal-search-${group.domain}`">{{ domainLabel(group.domain) }} <span>{{ formatCount(group.total) }} 条</span></h3><button type="button" :data-archive-focus-id="`portal-search-directory:${group.domain}`" @click="emit('navigate', group.domain)">查看目录<ChevronRight :size="15" aria-hidden="true" /></button></header>
              <ul>
            <li v-for="result in group.rows" :key="result.key">
              <DomainMediaPreview v-if="result.image?.url" class="overview-result-image" :binding="result.image" :name="result.label" compact />
              <span v-else class="overview-result-kind" aria-hidden="true"><component :is="archiveNavigationIcons[result.domain] || Search" :size="21" /></span>
              <button type="button" :disabled="!result.target" :data-archive-focus-id="`portal-search:${result.key}`" @click="setSearchCollapsed(false); emit('open-result', result)"><span class="overview-result-copy"><small>{{ domainLabel(result.domain) }}</small><strong>{{ result.label }}</strong><span v-if="result.subtitle">{{ result.subtitle }}</span></span><ArrowUpRight :size="18" aria-hidden="true" /></button>
            </li>
              </ul>
            </section>
          </template>
          <p v-else-if="!globalSearch.loading && !globalSearch.error" class="overview-status" role="status">{{ query.trim() ? '没有找到相关内容，试试名称或关键词。' : '搜索全站的偶像、卡片、歌曲与故事。' }}</p>
        </div>
      </section>
      <div class="overview-toolbar-actions"><slot name="toolbar" /></div>
      </header>
    <div class="portal-overview">
      <slot name="notices" />
      <!-- Scale of the archive as one line of links, not a row of number tiles. -->
      <p class="overview-footprint" :class="{'is-preferred-footprint': preferredReference?.actionable}" aria-label="当前视角资料数量" :aria-busy="!footprints.length">
        <button v-for="count in footprintSlots" :key="count.id" type="button" :disabled="count.value === null" :title="count.id === 'stories' ? '当前视角出场条目 / 全站可读故事条目' : '当前视角关联条目 / 全站收录条目'" @click="openDirectory(count.id)">
          <b>{{ formatCount(count.value) }}<small v-if="preferredReference?.actionable"> / {{ formatCount(count.total) }}</small></b> <span>{{ count.label }}</span>
        </button>
      </p>
      <!-- Phones have no sidebar: the archive home doubles as the index of every destination. Following an
           idol, that idol's hero comes first and the index follows it (inside the featured section below). -->
      <nav v-if="!preferredReference?.actionable" class="overview-directory" aria-label="常用栏目">
        <ArchiveDirectoryGrid :groups="destinations" :pick="DIRECTORY_PICK" focus-prefix="portal-directory" @navigate="id => emit('navigate', id)" @more="openNavigationDrawer" />
      </nav>

      <!-- Announced only: the placeholders below already hold the layout, so this line must not move it. -->
      <p v-if="desktopOverview.loading" class="overview-status overview-visually-hidden" role="status">正在读取门户资料…</p>
      <ArchiveErrorNote v-if="desktopOverview.error" class="overview-error">{{ desktopOverview.error }}<button type="button" data-archive-focus-id="portal-overview-retry" @click="emit('retry-overview')">重试门户资料</button></ArchiveErrorNote>

      <section v-if="!preferredReference?.actionable" class="overview-panel overview-unit-hub" aria-labelledby="portal-units-title">
        <header class="overview-section-heading"><h2 id="portal-units-title">找到你的组合 <small>{{ desktopOverview.units?.length || unitPlaceholderCount || '' }} 个组合</small></h2><button type="button" @click="emit('navigate', 'idols')">偶像目录<ChevronRight :size="16" /></button></header>
        <div class="overview-unit-matrix"><article v-for="(unit, index) in desktopOverview.units || []" ref="unitTiles" :key="unit.id" :data-near-key="unit.id" class="overview-unit-tile" :style="{'--unit-color':unit.color}">
          <button type="button" class="overview-unit-logo" :aria-label="`打开组合 ${unit.title}`" :data-archive-focus-id="`portal-unit:${unit.id}`" @click="emit('open-result', unit)"><span class="overview-unit-title" aria-hidden="true">{{ unit.title }}</span><img v-if="unitNear(unit.id, index) && !failedUnitLogos.has(unit.id)" :src="getUnitLogoUrl(unit.id)" :alt="unit.title" :fetchpriority="index < 4 ? 'high' : undefined" decoding="async" @error="failedUnitLogos.add(unit.id)" /></button>
          <div class="overview-unit-members" :aria-label="`${unit.title}成员`"><button v-for="idol in unit.members" :key="idol.id" type="button" :aria-label="`查看${idol.name}的档案`" @click="chooseScope(idol.id)"><ArchiveIdolAvatar :idol-code="unitNear(unit.id, index) ? idol.id : ''" :size="28" :ring-width="0" fallback-text="" decorative /></button></div>
        </article><article v-for="n in unitPlaceholderCount" :key="`unit-placeholder-${n}`" class="overview-unit-tile is-placeholder" aria-hidden="true"></article></div>
      </section>
      <section class="overview-panel overview-featured" :class="{'is-all-view': !preferredReference?.actionable}" :style="preferredReference?.actionable ? heroStyle : undefined" :aria-labelledby="preferredReference?.actionable ? 'portal-workbench-title' : 'portal-card-preview-title'">
          <div v-if="preferredReference?.actionable" class="overview-personal" :class="{'has-portrait': activePortrait && !portraitFailed}" :style="heroStyle">
            <header class="overview-identity">
              <div class="overview-portrait-slot"><span class="overview-signature" aria-hidden="true"></span><img v-if="activePortrait && !portraitFailed" class="overview-idol-art" :src="activePortrait.url" alt="" decoding="async" @error="portraitFailed = true" />
              <ArchiveIdolAvatar v-else-if="preferredReference?.actionable" :idol-code="preferredReference.idolCode" :size="88" :accent-color="preferredReference.accentColor" decorative />
              <Users v-else class="overview-all-mark" :size="76" aria-hidden="true" />
              </div><div class="overview-identity-copy">
                <p class="overview-eyebrow" :class="{'is-favorite':preferredReference?.idolCode === savedIdolCode}">{{ preferredReference?.idolCode === savedIdolCode ? '我的担当' : preferredReference?.actionable ? '偶像档案' : '全站档案' }}</p>
                <h2 id="portal-workbench-title">{{ preferredReference?.actionable ? preferredName : '每一颗星的故事' }}</h2>
                <p v-if="desktopOverview.kana" class="overview-kana">{{ desktopOverview.kana }}</p>
                <p v-if="desktopOverview.preferredUnitName" class="overview-unit-name"><img v-if="unitLogoUrl && !unitLogoFailed" :src="unitLogoUrl" :alt="desktopOverview.preferredUnitName" decoding="async" @error="unitLogoFailed = true" /><span v-else>{{ desktopOverview.preferredUnitName }}</span></p>
              </div>
            </header>
            <button class="overview-home-action" type="button" data-archive-focus-id="portal-open-home" @click="emit('open-home', preferredReference.idolCode)">去{{ sectionLabel('home') }}<small v-if="homeVoiceLabel" class="overview-home-voices">{{ homeVoiceLabel }}</small><ChevronRight :size="16" aria-hidden="true" /></button>
            <nav v-if="preferredReference?.actionable" class="overview-preferred-actions" aria-label="当前偶像快捷入口"><button v-for="action in preferredActions" :key="action.id" type="button" :data-archive-focus-id="`portal-preferred:${action.id}`" @click="emit('open-preferred', {action: action.id, idolCode: preferredReference.idolCode})"><component :is="preferredActionIcons[action.id]" :size="15" aria-hidden="true" />{{ action.label }}</button></nav>
            <!-- Quiet settings for this hero: one caption line under the shortcuts, or on wide pages the hero's top-right corner. -->
            <p class="overview-personal-meta">
              <button v-if="preferredReference?.actionable && preferredReference.idolCode !== savedIdolCode" class="overview-save-idol" type="button" @click="emit('save-preferred', preferredReference.idolCode)">设为我的担当</button>
              <button class="overview-producer-badge" type="button" @click="emit('edit-personal')">{{ producerDisplayName }}<ArrowUpRight :size="12" /></button>
            </p>
          </div>
          <!-- The banner's right half: four number rows (figure / total, label, a grey breakdown), every number already in the scope. -->
          <div v-if="preferredReference?.actionable" class="overview-personal-stats" aria-label="担当数据">
            <button
              v-for="tile in statTiles"
              :key="tile.id"
              class="overview-stat"
              type="button"
              :data-archive-focus-id="`portal-stat:${tile.id}`"
              :aria-label="tile.meta ? `${tile.label} ${tile.value}${tile.total ? ` / ${tile.total}` : ''}，${tile.meta}` : `${tile.label} ${tile.value ?? ''}`"
              @click="openStatTile(tile)"
            >
              <span class="overview-stat-line">
                <strong>{{ formatCount(tile.value) }}</strong><small v-if="tile.total" class="overview-stat-total">/ {{ formatCount(tile.total) }}</small>
                <span class="overview-stat-label">{{ tile.label }}</span>
                <ArrowUpRight :size="14" class="overview-stat-arrow" aria-hidden="true" />
              </span>
              <span v-if="tile.meta" class="overview-stat-meta" aria-hidden="true">{{ tile.meta }}</span>
            </button>
          </div>
          <nav v-if="preferredReference?.actionable" class="overview-directory" aria-label="常用栏目">
            <ArchiveDirectoryGrid :groups="destinations" :pick="DIRECTORY_PICK" focus-prefix="portal-directory" @navigate="id => emit('navigate', id)" @more="openNavigationDrawer" />
          </nav>
          <div class="overview-card-showcase">
            <header class="overview-section-heading overview-card-heading overview-chip-heading"><h3 id="portal-card-preview-title">{{ preferredReference?.actionable ? '精选卡片' : '卡面探索' }} <small v-if="desktopOverview.cardCounts?.total">{{ formatCount(desktopOverview.cardCounts.total) }}</small></h3>
              <nav v-if="!preferredReference?.actionable" class="overview-heading-chips overview-card-filters" aria-label="按属性与稀有度探索卡片"><button v-for="attribute in cardFilters.attributes" :key="attribute.id" class="is-attribute" type="button" :disabled="!cardFilters.attributeAvailable" :title="cardFilters.attributeAvailable ? '' : '属性索引暂不可用'" :style="{'--attribute':attribute.color,'--attribute-icon':attribute.icon}" @click="openDirectory('cards',{attribute:attribute.id})">{{ attribute.label }} <small>{{ attribute.count ?? '—' }}</small></button><button v-for="rarity in cardFilters.rarities" :key="rarity.id" type="button" @click="openDirectory('cards',{rarity:rarity.id})">{{ rarity.id }} <small>{{ rarity.count }}</small></button></nav>
              <span class="overview-heading-actions"><button v-if="!preferredReference?.actionable" class="overview-shuffle" type="button" @click="shuffleCards">换一组<Shuffle :size="15" aria-hidden="true" /></button><button type="button" data-archive-focus-id="portal-cards-all" @click="openDirectory('cards')">查看全部<ChevronRight :size="16" aria-hidden="true" /></button></span></header>
            <PortalCardBento :cards="collections.cards || []" :global="!preferredReference?.actionable" :offset="cardOffset" @open="emit('open-result',$event)" />
          </div>
      </section>

      <div class="overview-content-grid" :class="{'is-global-grid':!preferredReference?.actionable}">
          <section class="overview-panel overview-music" aria-labelledby="portal-song-preview-title">
            <header class="overview-section-heading"><h2 id="portal-song-preview-title">{{ preferredReference?.actionable ? '相关歌曲' : '歌曲与舞台' }} <small>{{ collectionCount('songs') }}</small></h2><button type="button" data-archive-focus-id="portal-songs-all" @click="openDirectory('songs')">查看全部<ChevronRight :size="16" aria-hidden="true" /></button></header>
            <div v-if="!preferredReference?.actionable" class="overview-story-tabs" role="group" aria-label="歌曲演唱范围"><button v-for="category in songCategories" :key="category.id" type="button" :aria-pressed="songCategory === category.id" @click="songCategory = category.id">{{ category.label }} <small>{{ category.count }}</small></button></div>
            <div v-if="songs.length" class="overview-song-list">
              <article v-for="song in songs" :key="song.id" class="overview-song">
                <div class="overview-song-cover"><DomainMediaPreview class="overview-song-image" :binding="song.image" :name="song.title" deferred /></div>
                <div class="overview-song-copy"><button class="overview-song-detail" type="button" :disabled="!song.target" :data-archive-focus-id="`portal-song:${song.id}`" @click="emit('open-result', song)"><strong>{{ song.title }}</strong><small v-if="song.performerLabel">{{ song.performerLabel }}</small><small v-else-if="song.performers?.length">{{ song.performers.map(person => person.name).join('、') }}</small><small v-else-if="song.unitName">{{ song.unitName }}</small><small v-if="song.relationLabel" class="overview-relation">{{ song.relationLabel }}</small></button></div>
                <button v-if="song.stageTarget" class="overview-stage-button" type="button" :aria-label="`在舞台中打开 ${song.title}`" :title="`在舞台中打开 ${song.title}`" :data-archive-focus-id="`portal-song-stage:${song.id}`" @click="emit('open-stage', song.stageTarget)"><Play :size="15" aria-hidden="true" /><span class="overview-visually-hidden">打开舞台</span></button>
              </article>
            </div>
            <p v-else class="overview-empty">{{ desktopOverview.loading ? '正在读取歌曲预览…' : '暂无可展示的歌曲预览，可前往目录查阅。' }}</p>
          </section>
        <section class="overview-panel overview-stories" aria-labelledby="portal-story-preview-title">
          <header class="overview-section-heading" :class="{'overview-chip-heading':preferredReference?.actionable}"><h2 id="portal-story-preview-title">{{ preferredReference?.actionable ? '出场故事' : '故事档案' }} <small>{{ preferredReference?.actionable ? collectionCount('stories') : `${readableMainCollections.length} 章` }}</small></h2><div v-if="preferredReference?.actionable" ref="storyChipsRef" class="overview-heading-chips overview-story-tabs" :class="{'has-overflow': storyChipsOverflow}" @scroll="updateStoryChipsOverflow" role="group" aria-label="故事分类"><button v-for="tab in storyTabs" :key="tab.id" type="button" :aria-pressed="storyTab === tab.id" @click="storyTab = tab.id">{{ tab.label }} <small v-if="tab.id !== 'all'">{{ tab.count }}</small></button></div><button type="button" data-archive-focus-id="portal-stories-all" @click="openDirectory('stories')">查看全部<ChevronRight :size="16" aria-hidden="true" /></button></header>
          <div v-if="!preferredReference?.actionable" class="overview-story-hub">          <div class="overview-main-index"><article v-for="chapter in readableMainCollections" :key="chapter.id"><button type="button" @click="emit('open-result', chapter)"><DomainMediaPreview v-if="chapter.image" :binding="chapter.image" :name="chapter.title" deferred /><span><strong>{{ chapterLabel(chapter.title) }}</strong><small>{{ chapter.chapterCount }} 节 · {{ chapter.episodeCount }} 话</small><ChevronRight :size="16" /></span></button></article></div><div class="overview-story-gateways"><button v-for="gateway in gateways" :key="gateway.id" type="button" @click="emit('open-result',{target:{view:'story_gateway',gateway:gateway.id}})"><component :is="gateway.icon" :size="18" /><span><strong>{{ gateway.label }}</strong><small v-if="gatewayCount(gateway) !== null" :title="storyGatewayNote(gateway, desktopOverview.gatewayCounts) || undefined">{{ formatCount(gatewayCount(gateway)) }} {{ gateway.unit || '篇' }}</small></span><ArrowUpRight :size="14" /></button></div></div>
          <div v-else-if="stories.length" class="overview-story-list"><article v-for="story in stories" :key="story.id" class="overview-story"><DomainMediaPreview v-if="story.image?.url" class="overview-story-image" :binding="story.image" :name="story.title" deferred /><span v-else class="overview-story-mark" aria-hidden="true"><BookOpen :size="21" /></span><button type="button" :disabled="!story.target" :data-archive-focus-id="`portal-story:${story.id}`" @click="emit('open-result', story)"><span class="overview-story-copy"><small v-if="story.subtitle">{{ storySubtitle(story.subtitle) }}</small><strong :class="{ 'is-title-pending': storyTitle.pending() }">{{ storyTitle(story.id, story.title) }}</strong></span><span v-if="story.cast?.length" class="overview-story-cast" role="img" :aria-label="`登场偶像：${story.cast.map(idol => idol.name).join('、')}`"><ArchiveIdolAvatar v-for="idol in story.cast.slice(0, 3)" :key="idol.id" :idol-code="idol.id" :accent-color="idol.accentColor" :size="24" :ring-width="1" :gap="1" decorative /><small v-if="story.cast.length > 3">+{{ story.cast.length - 3 }}</small></span><ArrowUpRight :size="16" aria-hidden="true" /></button></article></div>
          <p v-else class="overview-empty">{{ desktopOverview.loading ? '正在读取故事预览…' : '暂无可展示的故事预览，可前往目录查阅。' }}</p>
        </section>
        <section v-if="!preferredReference?.actionable" class="overview-panel overview-hub" aria-labelledby="portal-hub-title">
          <header class="overview-section-heading"><h2 id="portal-hub-title">通信与图鉴</h2></header>
          <div class="overview-hub-groups">
            <div v-for="group in hubGroups" :key="group.id" class="overview-hub-group">
              <h3>{{ group.label }}</h3>
              <nav class="overview-hub-links" :aria-label="group.label">
                <button v-for="entry in group.entries" :key="entry.id" type="button" :data-archive-focus-id="`portal-hub:${group.id}:${entry.id}`" @click="emit('navigate', entry.target)">
                  <span class="overview-hub-card-head">
                    <component :is="hubEntryIcons[entry.id] || ChevronRight" :size="16" aria-hidden="true" />
                    <strong>{{ entry.label }}</strong>
                  </span>
                  <small v-if="entry.count !== null" class="overview-hub-card-count">{{ formatCount(entry.count) }}</small>
                </button>
              </nav>
            </div>
          </div>
        </section>
        <section class="overview-panel overview-events" aria-labelledby="portal-event-preview-title">
          <header class="overview-section-heading" :class="{'overview-chip-heading overview-month-heading':almanacMonth}"><h2 id="portal-event-preview-title">{{ preferredReference?.actionable ? '活动足迹' : `315 岁时记 · ${almanacMonthNumber} 月` }}</h2>
            <div v-if="almanacMonth" class="overview-month-step" role="group" aria-label="选择月份"><button type="button" aria-label="上个月" @click="stepAlmanacMonth(-1)"><ChevronLeft :size="18" aria-hidden="true" /></button><output aria-live="polite">{{ almanacMonthNumber }} 月</output><button type="button" aria-label="下个月" @click="stepAlmanacMonth(1)"><ChevronRight :size="18" aria-hidden="true" /></button></div>
            <button type="button" data-archive-focus-id="portal-events-all" @click="openDirectory('events')">查看全部<ChevronRight :size="16" aria-hidden="true" /></button></header>
          <!-- 315 岁时记: the month's birthdays beside every event that opened in that month, reprints included;
               the gasha pools that opened in the month span the row below. -->
          <div v-if="almanacMonth" class="overview-almanac">
            <div class="overview-almanac-column"><h3>{{ almanacMonthNumber }} 月生日偶像 <small>{{ almanacMonth.birthdays.length }}</small></h3>
              <ul v-if="almanacMonth.birthdays.length" class="overview-birthdays"><li v-for="birthday in almanacMonth.birthdays" :key="birthday.idolCode"><button type="button" :data-archive-focus-id="`portal-birthday:${birthday.idolCode}`" @click="emit('open-result',{target:birthdayCollectionTarget(birthday.idolCode)})"><ArchiveIdolAvatar :idol-code="birthday.idolCode" :accent-color="idols.find(row => row.id === birthday.idolCode)?.color" :size="40" :ring-width="2" decorative /><span class="overview-birthday-copy"><strong>{{ almanacIdolName(birthday.idolCode) }}</strong><small>{{ birthday.month }}月{{ birthday.day }}日</small></span><span class="overview-birthday-action">生日剧情<ChevronRight :size="14" aria-hidden="true" /></span></button></li></ul>
              <p v-else class="overview-empty">这个月没有偶像过生日。</p>
            </div>
            <div class="overview-almanac-column"><h3>历年 {{ almanacMonthNumber }} 月活动 <small>{{ almanacMonth.events.length }}</small></h3>
              <div v-if="almanacMonth.events.length" class="overview-event-grid"><article v-for="event in almanacMonth.events" :key="event.id" class="overview-event"><DomainMediaPreview class="overview-event-image" :binding="event.image" :name="event.title" deferred /><button type="button" :data-archive-focus-id="`portal-almanac-event:${event.id}`" @click="emit('open-result',{target:almanacEventTarget(event.id)})"><span><strong>{{ event.title }}</strong><small>{{ [event.kind, almanacEventDate(event.releaseAt), event.isReprint ? '复刻' : ''].filter(Boolean).join(' · ') }}</small></span><ArrowUpRight :size="16" aria-hidden="true" /></button></article></div>
              <p v-else class="overview-empty">这个月还没有开过活动。</p>
            </div>
            <div v-if="almanacMonth.gashaState !== 'unavailable'" class="overview-almanac-column overview-almanac-gashas"><h3>历年 {{ almanacMonthNumber }} 月卡池 <small v-if="almanacMonth.gashaState === 'ready'">{{ almanacMonth.gashas.length }}</small></h3>
              <div v-if="almanacMonth.gashas.length" class="overview-event-grid"><article v-for="gasha in almanacMonth.gashas" :key="`${gasha.id}:${gasha.startAt}`" class="overview-event"><DomainMediaPreview class="overview-event-image" :binding="gasha.image" :name="gasha.title" deferred /><button type="button" :data-archive-focus-id="`portal-almanac-gasha:${gasha.id}:${gasha.startAt}`" @click="emit('open-result',{target:almanacGashaTarget(gasha.id)})"><span><strong>{{ gasha.title }}</strong><small>{{ [gasha.kind, almanacEventDate(gasha.startAt), gasha.isReprint ? '复刻' : ''].filter(Boolean).join(' · ') }}</small></span><ArrowUpRight :size="16" aria-hidden="true" /></button></article></div>
              <p v-else class="overview-empty" :role="almanacMonth.gashaState === 'loading' ? 'status' : null">{{ almanacMonth.gashaState === 'loading' ? '正在读取卡池…' : '这个月还没有开过卡池。' }}</p>
            </div>
          </div>
          <div v-else-if="preferredReference?.actionable && events.length" class="overview-event-grid"><article v-for="event in events" :key="event.id" class="overview-event"><DomainMediaPreview v-if="event.image?.url" class="overview-event-image" :binding="event.image" :name="event.title" deferred /><button type="button" :disabled="!event.target" :data-archive-focus-id="`portal-event:${event.id}`" @click="emit('open-result', event)"><span><strong>{{ event.title }}</strong><small v-if="event.subtitle">{{ event.subtitle }}</small><small v-if="event.relationLabel" class="overview-relation">{{ event.relationLabel }}</small></span><ArrowUpRight :size="16" aria-hidden="true" /></button></article></div>
          <p v-else class="overview-empty">{{ desktopOverview.loading ? '正在读取活动预览…' : preferredReference?.actionable ? '暂无可展示的活动记录，可前往目录查阅。' : '岁时记暂时无法载入，可前往活动目录查阅。' }}</p>
        </section>
      </div>
      <ArchiveTerminalDialog class="portal-scope-dialog" :open="scopeOpen" title="切换资料馆视角" title-id="portal-scope-title" @close="scopeOpen = false">
        <p class="overview-dialog-note">切换浏览视角不会修改已保存的担当。</p>
        <div class="overview-scope-actions"><button type="button" :aria-pressed="!preferredReference?.actionable" @click="chooseScope('')"><Users :size="18" />全站档案大厅</button><button v-if="savedIdolCode" type="button" @click="chooseScope(savedIdolCode)"><ArchiveIdolAvatar :idol-code="savedIdolCode" :size="28" decorative />我的担当 · {{ idolName(savedIdolCode, idols.find(row=>row.id===savedIdolCode)?.name) }}</button></div>
        <ArchiveIdolPickerPanel compact :idols="idols" :idol-name="idolName" :idol-search="idolSearch" :model-value="preferredReference?.idolCode || ''" @update:model-value="chooseScope" />
      </ArchiveTerminalDialog>
      <footer class="overview-footer">{{ ARCHIVE_BRAND.english }} · 非官方资料存档 · <button type="button" class="overview-footer-link" @click="emit('navigate', 'about')">关于本站</button></footer>
    </div>
  </div>
</template>

<script setup>
import { chapterLabel } from '../../presentation/chapterLabel.js'
import { useStoryTitles } from './useReaderTitles.js'
import { computed, defineAsyncComponent, inject, nextTick, onMounted, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ArrowLeft, ArrowUpRight, BookOpen, BriefcaseBusiness, ChevronLeft, ChevronRight, ChevronsUpDown, ContactRound, Layers, MessageCircle, Phone, Play, Search, Shuffle, Users, X } from '@lucide/vue'
import ArchiveErrorNote from './ArchiveErrorNote.vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import DomainMediaPreview from './DomainMediaPreview.vue'
import ArchiveTerminalDialog from './terminal/ArchiveTerminalDialog.vue'
import ArchiveIdolPickerPanel from './terminal/ArchiveIdolPickerPanel.vue'
import { archiveNavigationIcons } from './archiveNavigationIcons.js'
import { ARCHIVE_NAVIGATION_GROUPS as destinations } from '../../core/archiveNavigationGroups.js'
import { ARCHIVE_BRAND, sectionLabel } from '../../core/archiveSections.js'
import GsSegmented from '../gs/GsSegmented.vue'
import PortalCardBento from './PortalCardBento.vue'
import { useNearViewportKeys } from './useNearViewport.js'
import {ALMANAC_MONTHS,almanacEventDate,almanacEventTarget,almanacGashaTarget,birthdayCollectionTarget,currentJapanMonth,portalAlmanacMonth,withAlmanacGashas} from '../../presentation/PortalAlmanac.js'
import { PORTAL_FOOTPRINT_IDS, portalFootprintLabel } from '../../presentation/ArchivePortalPresentation.js'
import {storyGateways,storyGatewayCount,storyGatewayNote} from '../../presentation/StoryGateways.js'
import {portalCardFilters,portalHubGroups,portalPreferredStatTiles} from '../../presentation/PortalOverviewPanels.js'
import { getCharaSignUrl, getUnitLogoUrl } from '../../utils/AssetResolver.js'
import { classifySongLineup } from '../../presentation/SongPresentation.js'
import { idolStageLight } from '../../presentation/idolStageLight.js'
import idolVisualFocus from '../../presentation/idolVisualFocus.json'
// The directory grid is shared with the navigation drawer and loads with it, outside the startup bundle.
const ArchiveDirectoryGrid = defineAsyncComponent(() => import('./ArchiveDirectoryGrid.vue'))

const props = defineProps({
  canGoBack: Boolean,
  savedIdolCode: { type: String, default: '' },
  idols: { type: Array, default: () => [] },
  idolSearch: { type: Function, default: () => '' },
  producerDisplayName: { type: String, default: '' },
  preferredReference: { type: Object, default: null },
  idolName: { type: Function, default: () => '' },
  preferredActions: { type: Array, default: () => [] },
  desktopOverview: { type: Object, default: () => ({}) },
  globalSearch: { type: Object, default: () => ({}) },
})
const readableMainCollections = computed(() => (props.desktopOverview.mainCollections || []).filter(row => row.target && row.episodeCount > 0))
// Story rows carry only their file: the title comes from the Reader title index when one is bound,
// and "主线剧情 · 第5話" shows its chapter word in the reader's language.
const storyTitle = useStoryTitles()
const storySubtitle = text => String(text || '').split(' · ').map(chapterLabel).join(' · ')
const emit = defineEmits(['back', 'open-home', 'navigate', 'edit-personal', 'open-preferred', 'search', 'open-result', 'open-directory', 'open-stage', 'retry-overview', 'select-scope', 'save-preferred', 'expand-cards'])
const SEARCH_COLLAPSED_KEY = 'sidem:portal-search-collapsed'
function isSearchCollapsed() {
  try { return sessionStorage.getItem(SEARCH_COLLAPSED_KEY) === 'true' } catch { return false }
}
function setSearchCollapsed(collapsed) {
  try {
    if (collapsed) sessionStorage.setItem(SEARCH_COLLAPSED_KEY, 'true')
    else sessionStorage.removeItem(SEARCH_COLLAPSED_KEY)
  } catch {}
}

const searchPanel = ref(null), searchInput = ref(null)
const searchOpen = ref(Boolean(props.globalSearch?.query?.trim()) && !isSearchCollapsed())

function collapseSearch() {
  searchOpen.value = false
  setSearchCollapsed(true)
}
function closeSearchOutside(event) { if (searchPanel.value && !searchPanel.value.contains(event.target)) collapseSearch() }
onMounted(() => document.addEventListener('pointerdown',closeSearchOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown',closeSearchOutside))
const heading = ref(null)
defineExpose({ focusHeading: () => heading.value?.focus({ preventScroll: true }), restoreSearchFocus: () => searchInput.value?.focus({ preventScroll: true }) })
const footprints = computed(() => props.desktopOverview.footprints || [])
// Until the overview arrives, keep the same four footprint slots and one empty tile per unit (the unit list is
// in the bootstrap), so the counts and logos fill in place instead of pushing the page down.
const footprintSlots = computed(() => footprints.value.length ? footprints.value
  : PORTAL_FOOTPRINT_IDS.map(id => ({ id, label: portalFootprintLabel(id, Boolean(props.preferredReference?.actionable)), value: null, total: null })))
const unitPlaceholderCount = computed(() => props.desktopOverview.units?.length || props.desktopOverview.error ? 0
  : new Set(props.idols.map(idol => idol.unitCode).filter(Boolean)).size)
// The home holds the idol's general voices and every card's touch voices; the two are counted apart.
const homeVoiceLabel = computed(() => {
  const counts = props.desktopOverview.homeVoiceCounts
  return counts ? [counts.idol && `通用 ${counts.idol}`, counts.card && `卡面 ${counts.card}`].filter(Boolean).join(' · ') + ' 句语音' : ''
})
// Phones: two rows of the common destinations; the eighth cell, 全部栏目, opens the bar's drawer, which is the
// one full directory (线框减法册 L2). Both draw the same ArchiveDirectoryGrid.
const DIRECTORY_PICK = ['stories', 'interactions', 'idols', 'cards', 'songs', 'events', 'live']
const openNavigationDrawer = inject('openNavigationDrawer', () => {})
const scopeOpen = ref(false), storyTab = ref('all'), portraitFailed = ref(false)
const collections = computed(() => props.desktopOverview.collections || {})
const activePortrait=computed(()=>props.desktopOverview.portrait)
const gateways=storyGateways.filter(row=>row.action!=='external-resources')
// A gateway's number is trusted only when the pinned scope carries it: the four-row story preview is
// too small to count 活动剧情/组合前传, so a scope that predates them shows no number rather than 4.
function gatewayCount(gateway){
  const byAction=props.desktopOverview.gatewayCountsByAction
  if(byAction && Object.hasOwn(byAction,gateway.id)) return byAction[gateway.id]
  if(byAction) return null
  return storyGatewayCount(gateway,collections.value.stories || [],props.desktopOverview.gatewayCounts)
}
// 通信 and 图鉴 entries: names from the one section dictionary, counts only when the scope has them.
const cardFilters=computed(()=>portalCardFilters(props.desktopOverview.cardCounts,collections.value.cards || []))
const hubGroups=computed(()=>portalHubGroups(props.desktopOverview.collectionCounts))
const statTiles=computed(()=>props.preferredReference?.actionable ? portalPreferredStatTiles(props.desktopOverview) : [])
function openStatTile(tile){
  if(tile.action==='mobile') return emit('open-preferred',{action:'mobile',idolCode:props.preferredReference?.idolCode})
  openDirectory(tile.action)
}
// 315 岁时记 opens on this month in Japan time. It replaced the old event timeline (retired 10-30); a bound
// release must carry it (prepare-readmodel-preview runs verify-portal-almanac before any deploy).
const almanacMonthNumber=ref(currentJapanMonth())
const almanacMonth=computed(()=>props.preferredReference?.actionable ? null : portalAlmanacMonth(withAlmanacGashas(props.desktopOverview.almanac,props.desktopOverview.almanacGashas),almanacMonthNumber.value))
// The month is a stepper (‹ 10 月 ›): previous and next wrap around the year.
const stepAlmanacMonth=delta=>{ const at=ALMANAC_MONTHS.indexOf(almanacMonthNumber.value); almanacMonthNumber.value=ALMANAC_MONTHS[(at+delta+ALMANAC_MONTHS.length)%ALMANAC_MONTHS.length] }
const almanacIdolName=code=>props.idolName(code,props.idols.find(row=>row.id===code)?.name) || props.idols.find(row=>row.id===code)?.name || code
function collectionCount(id) { return formatCount(footprints.value.find(row => row.id === id)?.value) }
function chooseScope(code) { scopeOpen.value = false; emit('select-scope', code) }
const lensIdolCode = computed(() => props.preferredReference?.actionable ? props.preferredReference.idolCode : props.savedIdolCode)
const lensValue = computed(() => props.preferredReference?.actionable ? 'idol' : 'all')
const lensOptions = computed(() => [
  { value: 'all', label: '全站' },
  { value: 'idol', code: lensIdolCode.value, label: lensIdolCode.value
    ? (props.preferredReference?.actionable ? preferredName.value : props.idolName(lensIdolCode.value, props.idols.find(row => row.id === lensIdolCode.value)?.name))
    : '选择担当' },
])
function chooseLens(value) {
  if (value === 'all') chooseScope('')
  else if (lensIdolCode.value) chooseScope(lensIdolCode.value)
  else scopeOpen.value = true
}
function openDirectory(domain, filters = {}) {
  emit('open-directory', { domain, idolCode: props.preferredReference?.actionable ? props.preferredReference.idolCode : '', ...filters })
}
const hubEntryIcons = {
  ...archiveNavigationIcons,
  personal: MessageCircle,
  unit: Users,
  phone: Phone,
}

const storyChipsRef = ref(null)
const storyChipsOverflow = ref(false)
function updateStoryChipsOverflow() {
  const el = storyChipsRef.value
  if (!el) {
    storyChipsOverflow.value = false
    return
  }
  storyChipsOverflow.value = el.scrollWidth > el.clientWidth && (el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
}
let storyChipsObserver = null
onMounted(() => {
  if (typeof ResizeObserver !== 'undefined') {
    storyChipsObserver = new ResizeObserver(() => updateStoryChipsOverflow())
    if (storyChipsRef.value) storyChipsObserver.observe(storyChipsRef.value)
  }
  updateStoryChipsOverflow()
})
onBeforeUnmount(() => {
  if (storyChipsObserver) {
    storyChipsObserver.disconnect()
    storyChipsObserver = null
  }
})
watch(storyChipsRef, (el, oldEl) => {
  if (storyChipsObserver) {
    if (oldEl) storyChipsObserver.unobserve(oldEl)
    if (el) storyChipsObserver.observe(el)
  }
  nextTick(updateStoryChipsOverflow)
})

const storyTabs = computed(() => [{id:'all',label:'全部',count:props.desktopOverview.storyCounts?.all ?? (collections.value.stories || []).length},
  ...[['main','主线'],['event','活动'],['personal','个人'],['other','其他']].map(([id,label]) => ({id,label,count:props.desktopOverview.storyCounts?.[id] ?? (collections.value.stories || []).filter(row => storyGroup(row) === id).length})).filter(row => row.count)])
function storyGroup(row) { return ['main','event'].includes(row.domain) ? row.domain : ['idol_story','card_scenarios','work','birthday'].includes(row.domain) ? 'personal' : 'other' }
watch(storyTabs, () => { nextTick(updateStoryChipsOverflow); });
watch(() => props.desktopOverview.scopeId, () => { storyTab.value = 'all'; portraitFailed.value = false })
const cardOffset = ref(0)
function shuffleCards() { cardOffset.value += 1; emit('expand-cards') }
const songCategory = ref('configurable_formation')
const songCategories = computed(() => [['configurable_formation','代表曲'],['fixed_unit','组合曲'],['fixed_special_lineup','特别编成'],['all','全部歌曲']].map(([id,label]) => ({id,label,count:props.desktopOverview.songCounts?.[id] ?? (collections.value.songs || []).filter(row => id==='all' || classifySongLineup(row) === id).length})))
const songs = computed(() => props.preferredReference?.actionable ? props.desktopOverview.songs || [] : (collections.value.songs || []).filter(row => songCategory.value==='all' || classifySongLineup(row) === songCategory.value).slice(0,songCategory.value==='configurable_formation' ? 5 : 4))
const stories = computed(() => (collections.value.stories || []).filter(row => storyTab.value === 'all' || storyGroup(row) === storyTab.value).slice(0, 4))
const events = computed(() => collections.value.events || props.desktopOverview.events || [])
const query = computed(() => props.globalSearch.query || '')
const searchResults = computed(() => props.globalSearch.results || [])
const searchGroups = computed(() => ['idols', 'cards', 'songs', 'stories'].map(domain => {
  const rows = searchResults.value.filter(result => result.domain === domain)
  return { domain, total: rows.length, rows: rows.slice(0, 6) }
}).filter(group => group.total > 0))
const preferredName = computed(() => props.idolName(props.preferredReference?.idolCode, props.preferredReference?.displayName) || props.preferredReference?.displayName || '')
const quickSearchTerms = computed(() => props.preferredReference?.actionable
  ? [...new Set([props.desktopOverview.preferredUnitName, preferredName.value].filter(value => typeof value === 'string' && value.trim()))] : [])
const preferredActionIcons = { profile: ContactRound, story: BookOpen, cards: Layers, work: BriefcaseBusiness, mobile: MessageCircle }
const unitLogoUrl = computed(() => props.desktopOverview.preferredUnitCode ? getUnitLogoUrl(props.desktopOverview.preferredUnitCode) : '')
// The 担当 hero on phones: the idol's light wash, ink and light (idolStageLight keeps every colour
// readable), the autograph behind the figure, and the figure placed by where the person stands in the
// picture (idolVisualFocus) rather than by the picture's edge.
const HERO_FIGURE_HEIGHT = 300
const heroStyle = computed(() => {
  if (!props.preferredReference?.actionable) return undefined
  const light = idolStageLight(props.preferredReference.accentColor)
  const portrait = activePortrait.value
  const focus = portrait ? idolVisualFocus.focusX[portrait.url] ?? 0.5 : 0.5
  const width = portrait?.width && portrait?.height ? HERO_FIGURE_HEIGHT * portrait.width / portrait.height : HERO_FIGURE_HEIGHT * 0.66
  return {
    '--hero-wash': light?.wash, '--hero-ink': light?.ink, '--hero-light': light?.light,
    '--hero-sign': `url(${getCharaSignUrl(props.preferredReference.idolCode)})`,
    '--hero-figure-left': `calc(76% - ${Math.round(focus * width)}px)`,
  }
})
const unitLogoFailed = ref(false)
// Unit tiles whose logo failed keep the name in its place instead of a broken-image mark.
const failedUnitLogos = reactive(new Set())
// A tile's logo and member avatars load when it nears the viewport: sixteen logos and 49 avatars at
// once took the first screen's bandwidth on phones (native lazy loading starts 1250–2500 px ahead).
// The first row's logos are the Portal's largest first-screen images.
const unitTiles = ref([])
const nearUnits = useNearViewportKeys(unitTiles)
// The first two rows are on the first screen at every width; they need not wait for the observer's
// first callback (after layout and paint), which delays their requests on a slow phone.
const FIRST_SCREEN_UNITS = 6
const unitNear = (id, index) => index < FIRST_SCREEN_UNITS || nearUnits.has(id)
watch(unitLogoUrl, () => { unitLogoFailed.value = false })
function formatCount(value) { return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('zh-CN') : '—' }
function domainLabel(domain) { return { cards: '卡片', songs: '歌曲', idols: '偶像', stories: '故事' }[domain] || '档案' }
</script>

<style scoped>
/* A title still waiting for its translation keeps its place but stays hidden (no Japanese flash). */
.is-title-pending { visibility:hidden; }
/* The archive portal on the programme layout. One stylesheet, one order: base, toolbar and search,
   the footprint and the phone directory, the 担当 hero and featured cards, then the sections.
   Sections sit on the paper under a heading and a rule; only controls, the search popover and the
   art carry a surface. Component layout follows the page's own width (container portal); the
   viewport tiers decide only the shell-level rows (toolbar, phone directory). */
.portal-overview-scroll { position:relative;z-index:2;width:100%;height:100%;min-height:0;overflow:auto;scrollbar-width:thin; }
.portal-overview {
  --portal-accent:color-mix(in srgb,var(--portal-idol-color,var(--gs-mint)) 36%,var(--gs-ink));
  --portal-tint:color-mix(in srgb,var(--portal-idol-color,var(--gs-mint)) 7%,var(--gs-surface));
  --portal-line:color-mix(in srgb,var(--portal-idol-color,var(--gs-mint)) 15%,var(--gs-line));
  container:portal / inline-size;box-sizing:border-box;width:min(1264px,100%);min-width:0;margin:0 auto;padding:var(--gs-space-7) var(--gs-space-8) var(--gs-space-9);color:var(--gs-ink);font-family:var(--gs-font-directory);font-size:var(--gs-text-ui);line-height:1.6;
}
.portal-overview *, .portal-overview-scroll { box-sizing:border-box; }
.portal-overview button, .portal-overview input { font:inherit; }
.portal-overview button { cursor:pointer; }
.portal-overview button:disabled { cursor:default;color:var(--gs-ink-3); }
.portal-overview button:focus-visible, .portal-overview input:focus-visible, .portal-overview :deep(.domain-media-preview button:focus-visible) { outline:var(--gs-focus-ring) solid var(--gs-mint);outline-offset:var(--gs-focus-offset); }
.overview-visually-hidden { position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap; }

/* Toolbar: 资料馆 / scope · search · tools. */
/* The same 61px row as every page's title row (and the sidebar's brand row): pinned, full width, one hairline under it. */
.overview-toolbar { position:sticky;top:0;z-index:8;display:grid;grid-template-columns:auto minmax(180px,1fr) auto;align-items:center;gap:var(--gs-space-4);height:61px;padding:0 var(--gs-space-6) 0 var(--gs-gutter);border-bottom:1px solid var(--gs-line);background:var(--gs-paper); }
.overview-brand { display:flex;align-items:center;gap:var(--gs-space-3);min-width:0; }
.overview-brand h1 { margin:0;font-size:var(--gs-text-section);font-weight:var(--gs-weight-bold);line-height:1.3;white-space:nowrap; }
.overview-brand h1:focus { outline:none; }
.overview-icon-button { display:grid;place-items:center;flex:none;width:var(--gs-control-touch);height:var(--gs-control-touch);padding:0;border:0;border-radius:var(--gs-radius-control);background:transparent;color:var(--gs-ink-2); }
.overview-lens { min-width:0; max-width:100%; }
.overview-lens :deep(.gs-segmented-option) { gap:var(--gs-space-3); }
.overview-lens-name { max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.overview-toolbar-actions { display:flex;align-items:center;justify-content:flex-end;gap:var(--gs-space-1); }
.overview-toolbar-actions :deep(.archive-language-switch) { border:0;padding:0;background:transparent; }

.overview-search { position:relative;justify-self:end;width:100%;max-width:420px;min-width:0; }
.overview-search-form { display:flex;align-items:center;gap:var(--gs-space-3);min-width:0;min-height:var(--gs-control-touch);padding:2px 2px 2px var(--gs-space-4);border:1px solid var(--gs-line);border-radius:var(--gs-radius-field);background:var(--gs-surface);color:var(--gs-ink-3); }
.overview-search-form:focus-within { border-color:var(--gs-selected-line); }
.overview-search-form > svg { flex:none;width:17px; }
.overview-search-form input { flex:1;min-width:0;height:38px;padding:0;border:0;background:transparent;color:var(--gs-ink);font-size:var(--gs-text-ui); }
.overview-search-form input:focus-visible { outline:none; }
.overview-search-form input::placeholder { color:var(--gs-ink-3); }
.overview-search-form input::-webkit-search-cancel-button { display:none; }
.overview-search-form .overview-icon-button { width:32px;height:38px; }
.overview-search-submit { min-height:38px;padding:0 var(--gs-space-4);border:0;border-radius:6px;background:var(--gs-action-bg);color:var(--gs-action-ink);font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold); }
.overview-search-results { position:absolute;z-index:12;top:52px;right:0;width:min(620px,calc(100vw - 96px));max-height:min(560px,calc(100dvh - 160px));overflow:auto;overscroll-behavior:contain;padding:var(--gs-space-3) var(--gs-space-5);border-radius:var(--gs-radius-panel);background:var(--gs-surface);box-shadow:var(--gs-shadow-float); }
.overview-search-collapse { display:flex;align-items:center;gap:var(--gs-space-2);min-height:var(--gs-control-normal);margin-left:auto;padding:0 var(--gs-space-3);border:0;border-radius:var(--gs-radius-control);background:transparent;color:var(--gs-ink-3); }
.overview-search-shortcuts { display:flex;flex-wrap:wrap;align-items:center;gap:var(--gs-space-3);margin:var(--gs-space-3) 0;color:var(--gs-ink-3);font-size:var(--gs-text-meta); }
.overview-search-shortcuts > button { min-height:var(--gs-control-compact);padding:0 var(--gs-space-4);border:1px solid var(--gs-line);border-radius:var(--gs-radius-pill);background:var(--gs-surface);color:var(--gs-ink-2);font-size:var(--gs-text-meta);overflow-wrap:anywhere; }
.overview-search-total { margin:var(--gs-space-3) 0;color:var(--gs-ink-3);font-size:var(--gs-text-meta); }
.overview-search-results ul { margin:0;padding:0;list-style:none; }
.overview-result-group + .overview-result-group { margin-top:var(--gs-space-3);padding-top:var(--gs-space-3);border-top:1px solid var(--gs-line); }
.overview-result-group > header { display:flex;align-items:center;justify-content:space-between;gap:var(--gs-space-4); }
.overview-result-group h3 { margin:0;font-size:var(--gs-text-subtitle);font-weight:var(--gs-weight-semibold); }
.overview-result-group h3 > span { margin-left:var(--gs-space-3);color:var(--gs-ink-3);font-size:var(--gs-text-meta);font-weight:var(--gs-weight-regular); }
.overview-result-group > header > button { display:flex;align-items:center;gap:var(--gs-space-2);min-height:var(--gs-control-touch);padding:0;border:0;background:transparent;color:var(--gs-ink-2);font-size:var(--gs-text-ui); }
.overview-search-results li { display:flex;align-items:center;gap:var(--gs-space-4);min-width:0;padding:var(--gs-space-3) 0; }
.overview-search-results li + li { border-top:1px solid var(--gs-line); }
.overview-search-results li > button { display:flex;flex:1;align-items:center;justify-content:space-between;gap:var(--gs-space-5);min-width:0;min-height:var(--gs-control-touch);padding:0;border:0;background:transparent;color:inherit;text-align:left; }
.overview-search-results li > button > svg { flex:none;color:var(--gs-ink-3); }
.overview-result-copy { display:grid;min-width:0; }
.overview-result-copy small, .overview-result-copy > span { color:var(--gs-ink-3);font-size:var(--gs-text-meta);overflow-wrap:anywhere; }
.overview-result-copy strong { font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold);overflow-wrap:anywhere; }
.overview-result-kind { display:grid;place-items:center;flex:none;width:var(--gs-control-touch);height:var(--gs-control-touch);color:var(--gs-ink-3); }

/* Footprint: one line of counts that open their directories. */
.overview-footprint { display:flex;flex-wrap:wrap;gap:var(--gs-space-2) var(--gs-space-6);margin:var(--gs-space-4) 0 0;color:var(--gs-ink-3);font-size:var(--gs-text-ui); }
.overview-footprint button { min-height:var(--gs-control-compact);padding:0;border:0;background:none;color:inherit; }
.overview-footprint b { margin-right:var(--gs-space-2);color:var(--gs-ink);font-family:var(--gs-font-stage);font-size:var(--gs-text-subtitle);font-weight:var(--gs-weight-semibold);font-variant-numeric:tabular-nums; }
.overview-footprint b small { color:var(--gs-ink-3);font-family:var(--gs-font-body);font-size:var(--gs-text-meta);font-weight:var(--gs-weight-regular); }
.overview-directory { display:none; }

.overview-status, .overview-empty { margin:0;padding:var(--gs-space-4) 0;color:var(--gs-ink-3);font-size:var(--gs-text-ui); }
.overview-error { margin:0;padding:var(--gs-space-4) 0;font-size:var(--gs-text-ui); }
.overview-error button, .overview-error > button { min-height:var(--gs-control-touch);margin-left:var(--gs-space-4);padding:0 var(--gs-space-4);border:1px solid var(--gs-line);border-radius:var(--gs-radius-control);background:var(--gs-surface);color:var(--gs-ink);font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold);cursor:pointer; }

/* Sections: heading and count on one baseline over a rule, the directory link at the end. */
.overview-panel { min-width:0;margin-top:var(--gs-space-section); }
.overview-section-heading { display:flex;align-items:baseline;justify-content:space-between;gap:var(--gs-space-4);margin-bottom:var(--gs-space-4);padding-bottom:var(--gs-space-3);border-bottom:1px solid var(--gs-rule); }
.overview-section-heading h2, .overview-section-heading h3 { margin:0;font-size:var(--gs-text-section);font-weight:var(--gs-weight-bold);line-height:1.4; }
.overview-section-heading h2 > small, .overview-section-heading h3 > small { margin-left:var(--gs-space-3);color:var(--gs-ink-3);font-size:var(--gs-text-meta);font-weight:var(--gs-weight-regular); }
.overview-section-heading button, .overview-heading-actions { display:flex;flex:none;align-items:center;gap:var(--gs-space-2); }
.overview-section-heading button { flex-shrink:0;white-space:nowrap;min-height:var(--gs-control-compact);padding:0;border:0;background:transparent;color:var(--gs-ink-2);font-size:var(--gs-text-ui); }
.overview-heading-actions { gap:var(--gs-space-5); }
/* Chips inside a heading row: one quiet pill row between the title and its actions, scrolling when it
   runs out of room. Each chip opens the directory filtered by it. */
/* The chip row keeps a focus-ring margin inside its scroller but adds no height: a heading with chips is
   exactly as tall as one without, so the lists under two side-by-side headings start on one line. */
.overview-heading-chips { display:flex;flex:1;gap:var(--gs-space-2);min-width:0;overflow-x:auto;margin-block:calc(-1 * var(--gs-space-1));padding:var(--gs-space-1);scrollbar-width:none; }
.overview-heading-chips.has-overflow { -webkit-mask-image:linear-gradient(to right, black calc(100% - var(--gs-space-6)), transparent 100%);mask-image:linear-gradient(to right, black calc(100% - var(--gs-space-6)), transparent 100%); }
.overview-heading-chips::-webkit-scrollbar { display:none; }
.overview-section-heading .overview-heading-chips.overview-story-tabs { margin:calc(-1 * var(--gs-space-1)) 0; }
/* Chips are text, not pills (线框减法册 rule 2): no frame or fill on the heading rule; a chosen tab is ink
   with the mint underline, the card filters are plain links into the card directory. */
.overview-section-heading .overview-heading-chips button { flex:none;gap:0;padding:0 var(--gs-space-2);border:0;border-bottom:2px solid transparent;border-radius:0;background:transparent;color:var(--gs-ink-2);font-size:var(--gs-text-meta);white-space:nowrap; }
.overview-heading-chips button small { margin-left:var(--gs-space-2);color:var(--gs-ink-3);font-weight:var(--gs-weight-regular);font-variant-numeric:tabular-nums; }
.overview-section-heading .overview-heading-chips button[aria-pressed=true] { border-bottom-color:var(--gs-selected-line);color:var(--gs-ink);font-weight:var(--gs-weight-semibold); }
.overview-section-heading .overview-heading-chips button[aria-pressed=true] small { color:var(--gs-ink-3); }
.overview-section-heading .overview-heading-chips .is-attribute { color:var(--attribute);font-weight:var(--gs-weight-semibold); }
.overview-heading-chips .is-attribute::before { content:"";flex:none;width:15px;height:15px;margin-right:4px;background:var(--attribute-icon) center / contain no-repeat; }
.overview-heading-chips button:disabled { opacity:.55;cursor:default; }
.overview-section-heading .overview-shuffle { color:var(--gs-ink-2); }

/* Featured: the 担当 hero beside the featured cards. */
.overview-featured { display:grid;grid-template-columns:minmax(0,1fr);gap:var(--gs-space-8);margin-top:var(--gs-space-7);--idol-soft-bg:color-mix(in srgb,var(--hero-wash,var(--gs-mint-wash)) 75%,var(--gs-surface));--idol-ink:var(--hero-ink,var(--gs-mint-ink)); }
.overview-unit-hub + .overview-featured { margin-top:var(--gs-space-section); }
.overview-personal, .overview-card-showcase { min-width:0; }
/* The 担当 banner on wide pages: the hero card and its four tiles share the page's one 50:50 axis (the same
   column gap as the lists below), stretched to one height; the gallery then takes the full row. */
.overview-personal-stats { display:none; }
@container portal (min-width:981px) {
  .overview-footprint.is-preferred-footprint { display:none; }
  .overview-featured:not(.is-all-view) { grid-template-columns:repeat(2,minmax(0,1fr));column-gap:var(--gs-space-8);margin-top:var(--gs-space-4); }
  .overview-featured:not(.is-all-view) > .overview-card-showcase { grid-column:1 / -1; }
  .overview-featured:not(.is-all-view) .overview-identity { flex:1;height:auto;min-height:228px; }
  .overview-personal-stats { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));gap:var(--gs-space-3); }
  /* The hero's quiet settings sit on the same line as 去事务所, at the other corner, clear of the face. */
  .overview-featured:not(.is-all-view) .overview-personal-meta { position:absolute;top:176px;right:var(--gs-space-5);z-index:4;min-height:var(--gs-control-compact);padding:0 var(--gs-space-4);border:0;border-radius:var(--gs-radius-pill);background:color-mix(in srgb,var(--gs-surface) 88%,transparent); }
  .overview-content-grid:not(.is-global-grid) .overview-event-grid { grid-template-columns:repeat(2,minmax(0,1fr));column-gap:var(--gs-space-8); }
}
/* Numbers are text: a hairline row, the stage face for the figure, one grey line for the breakdown. No box. */
.overview-stat { display:flex;flex-direction:column;justify-content:center;gap:var(--gs-space-2);min-width:0;padding:var(--gs-space-3) 0;border:0;border-bottom:1px solid var(--gs-line);border-radius:0;background:transparent;color:var(--gs-ink);text-align:left;cursor:pointer; }
.overview-stat:focus-visible { outline:var(--gs-focus-ring) solid var(--gs-mint);outline-offset:var(--gs-focus-offset); }
.overview-stat:hover .overview-stat-arrow { color:var(--idol-ink,var(--gs-mint-ink)); }
.overview-stat-line { display:flex;align-items:baseline;gap:var(--gs-space-2);min-width:0; }
.overview-stat-line strong { font-family:var(--gs-font-stage);font-size:var(--gs-text-title);font-weight:var(--gs-weight-bold);font-variant-numeric:tabular-nums;line-height:1;color:var(--gs-ink); }
.overview-stat-label { color:var(--gs-ink-2);font-size:var(--gs-text-ui);font-weight:var(--gs-weight-medium); }
.overview-stat-meta { color:var(--gs-ink-3);font-size:var(--gs-text-meta);line-height:var(--gs-leading-ui); }
.overview-stat:hover { background:var(--gs-hover); }
.overview-stat-total { color:var(--gs-ink-3);font-family:var(--gs-font-stage);font-size:var(--gs-text-ui);font-weight:var(--gs-weight-regular);font-variant-numeric:tabular-nums; }
.overview-stat-arrow { flex:none;margin-left:auto;color:var(--gs-ink-3);align-self:center; }
.overview-personal { position:relative;display:flex;flex-direction:column;gap:var(--gs-space-3); }
/* The hero is artwork: the idol's light wash, the autograph in the idol's ink behind the figure,
   the figure placed by where the person stands. It gets the media radius and nothing else. */
.overview-identity { position:relative;height:228px;overflow:hidden;border-radius:var(--gs-radius-media);background:radial-gradient(circle at 76% 62%,var(--gs-surface) 0,var(--hero-wash,var(--gs-paper)) 58%); }
.overview-portrait-slot { position:absolute;inset:0; }
.overview-idol-art { position:absolute;left:var(--hero-figure-left,40%);bottom:-40px;z-index:2;width:auto;max-width:none;height:300px;object-fit:contain;mask-image:linear-gradient(#000 85%,transparent);-webkit-mask-image:linear-gradient(#000 85%,transparent);filter:drop-shadow(6px 4px 0 color-mix(in oklab,var(--hero-ink,var(--gs-ink)) 24%,transparent)); }
.overview-signature { position:absolute;top:86px;left:148px;z-index:3;display:block;width:130px;height:52px;opacity:.8;background:var(--hero-ink,var(--gs-ink-3));-webkit-mask:var(--hero-sign) center/contain no-repeat;mask:var(--hero-sign) center/contain no-repeat;mask-mode:luminance; }
.overview-identity-copy { position:relative;z-index:3;display:flex;flex-direction:column;width:170px;padding:var(--gs-space-6) var(--gs-space-5); }
.overview-eyebrow { order:0;margin:0;color:var(--hero-ink,var(--gs-ink-3));font-size:var(--gs-text-meta);font-weight:var(--gs-weight-semibold); }
.overview-unit-name { order:1;display:flex;align-items:center;margin:var(--gs-space-3) 0 0;color:var(--gs-ink-3);font-size:var(--gs-text-meta); }
.overview-unit-name > img { width:auto;max-width:112px;height:28px;object-fit:contain;object-position:left center; }
.overview-identity-copy h2 { order:2;margin:6px 0 4px;font-size:var(--gs-text-section);font-weight:var(--gs-weight-bold);line-height:1.25;overflow-wrap:anywhere; }
.overview-kana { order:3;margin:0;color:var(--gs-ink-3);font-size:var(--gs-text-meta); }
/* The way home sits on the art like the player's controls: a surface pill. */
.overview-home-action { position:absolute;top:176px;left:var(--gs-space-5);z-index:4;display:inline-flex;align-items:center;gap:2px;min-height:var(--gs-control-compact);padding:0 var(--gs-space-4);border:0;border-radius:var(--gs-radius-pill);background:color-mix(in srgb, var(--gs-surface) 88%, transparent);color:var(--gs-ink);font-size:var(--gs-text-meta);font-weight:var(--gs-weight-semibold);box-shadow:var(--gs-shadow-float); }
.overview-home-voices { margin-left:6px;color:var(--gs-ink-3);font-weight:var(--gs-weight-regular);font-variant-numeric:tabular-nums; }
/* Shortcuts: this idol's five archive pages, the main way on from the hero. They sit on a band of
   the hero's own wash with icons in the idol's ink (idolStageLight keeps both readable), so they
   read as part of the 担当 block and stand out from the quiet line below. */
.overview-preferred-actions { display:flex;flex-wrap:wrap;align-items:center;gap:0 var(--gs-space-2); }
.overview-preferred-actions button { display:inline-flex;align-items:center;gap:var(--gs-space-2);min-height:var(--gs-control-compact);padding:0 var(--gs-space-3);border:0;border-radius:var(--gs-radius-control);background:transparent;color:var(--gs-ink-2);font-size:var(--gs-text-ui);font-weight:var(--gs-weight-medium); }
.overview-preferred-actions button svg { width:16px;height:16px;color:var(--gs-ink-3); }
/* Quiet settings: 设为担当 and the producer — one caption line, separated by dots. */
.overview-personal-meta { display:flex;flex-wrap:wrap;align-items:center;gap:0 var(--gs-space-2);margin:0;padding-top:var(--gs-space-3);border-top:1px solid var(--gs-line);color:var(--gs-ink-3);font-size:var(--gs-text-meta); }
.overview-personal-meta:empty { display:none; }
.overview-personal-meta button { display:inline-flex;align-items:center;gap:2px;min-height:var(--gs-control-compact);padding:0;border:0;background:none;color:var(--gs-ink-2);font-size:var(--gs-text-meta); }
.overview-personal-meta button + button::before { content:'·';margin-right:var(--gs-space-2);color:var(--gs-ink-3); }
.overview-personal-meta .overview-save-idol { color:var(--gs-ink);font-weight:var(--gs-weight-semibold);text-decoration:underline;text-underline-offset:3px; }

/* Global view: the unit matrix, in each unit's own colour. */
.overview-unit-hub { margin-top:var(--gs-space-7); }
/* 16 units as an 8 x 2 hairline grid: logo and the members' group-ring faces, no per-unit background colour. */
.overview-unit-matrix { display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:0;border-top:1px solid var(--gs-line);border-left:1px solid var(--gs-line); }
@media (max-width:1100px) { .overview-unit-matrix { grid-template-columns:repeat(4,minmax(0,1fr)); } }
.overview-unit-tile { position:relative;container:unit-tile / inline-size;min-width:0;height:104px;overflow:hidden;border-right:1px solid var(--gs-line);border-bottom:1px solid var(--gs-line);background:transparent; }
.overview-unit-tile.is-placeholder { --unit-color:var(--gs-ink-3); }
.overview-unit-logo { display:grid;place-items:center;width:100%;height:100%;padding:10px 12px 40px;border:0;border-radius:inherit;background:transparent; }
.overview-unit-logo img { grid-area:1 / 1;width:100%;height:100%;max-width:118px;object-fit:contain; }
/* The unit name holds the logo's place until the logo arrives (imageReveal keeps it transparent
   till then), so a cold first screen reads as sixteen named units rather than empty frames. */
.overview-unit-title { grid-area:1 / 1;max-width:100%;overflow:hidden;color:var(--gs-ink-2);font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold);text-overflow:ellipsis;white-space:nowrap;transition:opacity var(--gs-motion-enter) var(--gs-ease-out); }
.overview-unit-logo:has(img[data-gs-loaded]) .overview-unit-title { opacity:0; }
.overview-unit-members { position:absolute;right:0;bottom:8px;left:0;display:flex;justify-content:center;gap:3px; }
.overview-unit-members button { padding:0;border:0;border-radius:50%;background:transparent; }
/* Members sit side by side while they fit; a narrow tile with four or more overlaps them. */
@container unit-tile (max-width:150px) {
  .overview-unit-members { --idol-avatar-override-size:24px; }
  .overview-unit-members:has(> :nth-child(4)) { gap:0;--idol-avatar-override-size:22px; }
  .overview-unit-members:has(> :nth-child(4)) button + button { margin-left:-6px; }
}

/* Content sections. Stories and music share a row on wide pages; 通信/图鉴 and the events follow full width. */
.overview-content-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:var(--gs-space-8); }
.overview-hub, .overview-events { grid-column:1 / -1; }

/* 通信 and 图鉴: one block of quiet link pills, each group titled by the section dictionary. */
/* 通信 and 图鉴 are one table: the label in the first column, three entries per row, hairlines straight across. */
.overview-hub-groups { display:block;border-bottom:1px solid var(--gs-line); }
.overview-hub-group { display:grid;grid-template-columns:88px minmax(0,1fr);gap:var(--gs-space-4);min-width:0;border-top:1px solid var(--gs-line); }
.overview-hub-group > h3 { margin:0;padding-top:var(--gs-space-4);color:var(--gs-ink-3);font-size:var(--gs-text-meta);font-weight:var(--gs-weight-semibold);letter-spacing:var(--gs-track-label); }
.overview-hub-links { display:grid;grid-template-columns:repeat(3,minmax(0,1fr)); }
.overview-hub-links button { display:flex;flex-direction:row;align-items:center;gap:var(--gs-space-3);min-height:var(--gs-row);padding:0 var(--gs-space-3);border:0;border-radius:0;background:transparent;color:var(--gs-ink-2);text-align:left;box-sizing:border-box; }
.overview-hub-links button:hover { background:var(--gs-hover); }
.overview-hub-links button:hover .overview-hub-card-head > strong { color:var(--gs-ink); }
.overview-hub-links button:hover .overview-hub-card-head > strong { color:var(--gs-ink); }
.overview-hub-card-head { display:flex;align-items:center;gap:var(--gs-space-3);flex:1;min-width:0; }
.overview-hub-card-head > svg { flex:none;color:var(--gs-ink-3); }
.overview-hub-card-head > strong { flex:1;min-width:0;font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold);white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.overview-hub-card-count { margin:0;color:var(--gs-ink-3);font-size:var(--gs-text-meta);font-variant-numeric:tabular-nums; }

/* Filter chips: stories by kind, songs by lineup. One scrolling row. */
.overview-story-tabs { display:flex;gap:var(--gs-space-5);overflow-x:auto;margin:0 0 var(--gs-space-2);padding:0;scrollbar-width:none; }
.overview-story-tabs button { flex:none;min-height:var(--gs-control-compact);padding:0 var(--gs-space-1);border:0;border-bottom:2px solid transparent;border-radius:0;background:transparent;color:var(--gs-ink-3);font-size:var(--gs-text-ui);white-space:nowrap; }
.overview-story-tabs button[aria-pressed=true] { border-bottom-color:var(--gs-selected-line);color:var(--gs-ink);font-weight:var(--gs-weight-semibold); }
.overview-story-tabs small { margin-left:var(--gs-space-2);color:var(--gs-ink-3);font-weight:var(--gs-weight-regular);font-variant-numeric:tabular-nums; }

/* Rows: picture, title and one line of meta, split by hairlines; the whole row opens. */
.overview-song-list, .overview-story-list { display:grid; }
.overview-song, .overview-story { display:flex;align-items:center;gap:var(--gs-space-4);min-width:0;padding:var(--gs-space-4) 0;border-bottom:1px solid var(--gs-line); }
.overview-song-cover { flex:none; }
.overview-song-copy { flex:1;min-width:0; }
.overview-song-detail { display:grid;gap:2px;width:100%;min-width:0;min-height:var(--gs-control-touch);padding:0;border:0;background:transparent;color:inherit;text-align:left; }
.overview-song strong, .overview-story strong { font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold);line-height:1.5;overflow-wrap:anywhere; }
.overview-event strong { font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold);line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.overview-event small { overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.overview-song small, .overview-story small, .overview-event small { color:var(--gs-ink-3);font-size:var(--gs-text-meta);overflow-wrap:anywhere; }
/* Relation labels are meta, not badges. */
.overview-relation { color:var(--gs-ink-2) !important; }
.overview-stage-button { display:grid;flex:none;place-items:center;width:var(--gs-control-touch);height:var(--gs-control-touch);padding:0;border:0;border-radius:var(--gs-radius-control);background:transparent;color:var(--gs-ink-2); }
.overview-song-image, .overview-story-image, .overview-event-image { position:relative;display:flex;flex:none;align-items:center;justify-content:center;margin:0;padding:0;border:0;border-radius:var(--gs-radius-media);overflow:hidden;background:var(--gs-line); }
.overview-song-image { width:56px;height:56px; }
.overview-story-image { width:44px;height:44px; }
.overview-event-image { width:128px;height:72px; }
.overview-song-image:deep(img), .overview-story-image:deep(img), .overview-event-image:deep(img) { display:block;width:100%;height:100%;margin:0;object-fit:cover; }
.overview-song-image:deep(.domain-resource-empty), .overview-story-image:deep(.domain-resource-empty), .overview-event-image:deep(.domain-resource-empty) { display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:0;margin:0;background:transparent;color:var(--gs-ink-3);font-size:var(--gs-text-meta); }
.overview-song-image:deep(.domain-resource-empty span), .overview-story-image:deep(.domain-resource-empty span), .overview-song-image:deep(figcaption), .overview-story-image:deep(figcaption) { display:none; }
.overview-event-image:deep(figcaption) { position:absolute;inset:auto var(--gs-space-3) var(--gs-space-2);margin:0;color:var(--gs-ink-3);font-size:var(--gs-text-meta); }
.portal-overview :deep(.domain-media-preview button) { min-height:var(--gs-control-touch);padding:0 var(--gs-space-3);border:1px solid var(--gs-line);border-radius:var(--gs-radius-control);background:var(--gs-surface);color:var(--gs-ink-2);font-size:var(--gs-text-ui); }
.overview-song-image:deep(button), .overview-story-image:deep(button) { width:var(--gs-control-touch);padding:0;font-size:var(--gs-text-meta); }
.overview-story-mark { display:grid;flex:none;place-items:center;width:44px;height:44px;color:var(--gs-ink-3); }
.overview-story > button, .overview-event > button { display:flex;flex:1;align-items:center;justify-content:space-between;gap:var(--gs-space-4);min-width:0;min-height:var(--gs-control-touch);padding:0;border:0;background:transparent;color:inherit;text-align:left; }
.overview-story > button > span, .overview-event > button > span { display:grid;gap:2px;min-width:0; }
.overview-story-copy { flex:1; }
.overview-story > button > svg, .overview-event > button > svg { flex:none;color:var(--gs-ink-3); }
.overview-story > button > .overview-story-cast { display:flex;flex:none;align-items:center;gap:0; }
.overview-story-cast :deep(.idol-avatar-shell + .idol-avatar-shell) { margin-left:-5px; }
.overview-story .overview-story-cast > small { margin-left:var(--gs-space-2);color:var(--gs-ink-3);font-size:var(--gs-text-meta);font-variant-numeric:tabular-nums; }
.overview-event-grid { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));column-gap:var(--gs-space-6); }
.overview-event { display:flex;align-items:center;gap:var(--gs-space-4);min-width:0;padding:var(--gs-space-4) 0;border-bottom:1px solid var(--gs-line); }

/* Global stories: two tiers on desktop (banners on top, gateways in a 2-column grid below). */
.overview-story-hub { display:flex;flex-direction:column;gap:var(--gs-space-6); }
.overview-main-index { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:var(--gs-space-8);row-gap:var(--gs-space-4);align-content:start; }
.overview-main-index button { display:block;width:100%;padding:0;border:0;background:none;color:inherit;text-align:left; }
.overview-main-index article :deep(.domain-media-preview) { display:block;margin:0;padding:0; }
.overview-main-index article :deep(img) { display:block;width:100%;height:auto;aspect-ratio:906 / 210;object-fit:cover;border-radius:var(--gs-radius-media); }
.overview-main-index article :deep(figcaption) { display:none; }
.overview-main-index button > span { display:flex;flex-wrap:wrap;align-items:baseline;gap:0 var(--gs-space-3);padding-top:var(--gs-space-3); }
.overview-main-index strong { font-size:var(--gs-text-subtitle);font-weight:var(--gs-weight-semibold); }
.overview-main-index small { flex:1;color:var(--gs-ink-3);font-size:var(--gs-text-meta); }
.overview-main-index button > span > svg { align-self:center;color:var(--gs-ink-3); }
.overview-main-index article:has(button:disabled) { opacity:.6; }
.overview-story-gateways { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:var(--gs-space-8);align-content:start;border-top:1px solid var(--gs-line); }
.overview-story-gateways button { display:flex;align-items:center;gap:var(--gs-space-4);min-width:0;min-height:56px;padding:0 var(--gs-space-2);border:0;border-bottom:1px solid var(--gs-line);background:none;color:var(--gs-ink);text-align:left; }
.overview-story-gateways button:last-child:nth-child(odd) { grid-column:1 / -1; }
.overview-story-gateways button > svg { flex:none;color:var(--gs-ink-3); }
.overview-story-gateways button > span { display:flex;flex:1;align-items:center;justify-content:space-between;gap:var(--gs-space-3);min-width:0; }
.overview-story-gateways strong { font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold);white-space:nowrap; }
.overview-story-gateways small { color:var(--gs-ink-3);font-size:var(--gs-text-meta); }

/* 315 岁时记: birthdays and events of one month on the page's 50:50 axis; the events reuse the event rows. */
/* The stepper's buttons carry no text, so a baseline row would lift it; the month heading centres its row instead. */
.overview-month-heading { align-items:center; }
.overview-month-step { display:inline-flex;align-items:center;gap:var(--gs-space-2);margin-left:auto; }
.overview-month-step output { min-width:56px;color:var(--gs-ink);font-family:var(--gs-font-stage);font-size:var(--gs-text-subtitle);font-weight:var(--gs-weight-semibold);text-align:center;font-variant-numeric:tabular-nums; }
.overview-month-step button { display:grid;place-items:center;width:var(--gs-control-touch);height:var(--gs-control-touch);padding:0;border:0;border-radius:var(--gs-radius-control);background:transparent;color:var(--gs-ink-2);cursor:pointer; }
.overview-month-step button:hover { background:var(--gs-hover); }
.overview-month-step button:focus-visible { outline:var(--gs-focus-ring) solid var(--gs-mint);outline-offset:var(--gs-focus-offset); }
.overview-almanac { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--gs-space-6) var(--gs-space-8); }
.overview-almanac-column { min-width:0;container:almanac-col / inline-size; }
.overview-almanac-column > h3 { margin:0 0 var(--gs-space-2);color:var(--gs-ink-2);font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold); }
.overview-almanac-column > h3 small { margin-left:var(--gs-space-2);color:var(--gs-ink-3);font-size:var(--gs-text-meta);font-weight:var(--gs-weight-regular); }
.overview-almanac .overview-event-grid { grid-template-columns:minmax(0,1fr); }
.overview-almanac-gashas { grid-column:1 / -1; }
@container almanac-col (min-width:560px) {
  .overview-almanac .overview-event-grid { grid-template-columns:repeat(2,minmax(0,1fr));column-gap:var(--gs-space-4); }
}
@container almanac-col (min-width:1000px) {
  .overview-almanac-gashas .overview-event-grid { grid-template-columns:repeat(3,minmax(0,1fr)); }
}
.overview-birthdays { display:grid;margin:0;padding:0;list-style:none; }
.overview-birthdays li { border-bottom:1px solid var(--gs-line); }
.overview-birthdays button { display:flex;align-items:center;gap:var(--gs-space-4);width:100%;min-height:72px;padding:var(--gs-space-3) 0;border:0;background:none;color:inherit;text-align:left;cursor:pointer; }
.overview-birthday-copy { display:grid;flex:1;gap:2px;min-width:0; }
.overview-birthdays strong { font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold); }
.overview-birthdays small { color:var(--gs-ink-3);font-size:var(--gs-text-meta);font-variant-numeric:tabular-nums; }
.overview-birthday-action { display:inline-flex;flex:none;align-items:center;gap:2px;color:var(--gs-ink-2);font-size:var(--gs-text-meta);font-weight:var(--gs-weight-semibold); }
.overview-birthdays button:focus-visible { outline:var(--gs-focus-ring) solid var(--gs-mint);outline-offset:var(--gs-focus-offset); }


/* Scope dialog and footer. */
.overview-dialog-note { margin:0 0 var(--gs-space-4);color:var(--gs-ink-3);font-size:var(--gs-text-ui); }
.overview-scope-actions { display:grid;grid-template-columns:1fr 1fr;gap:var(--gs-space-4);margin-bottom:var(--gs-space-5); }
.overview-scope-actions button { display:flex;align-items:center;justify-content:center;gap:var(--gs-space-3);min-height:52px;border:1px solid var(--gs-line);border-radius:var(--gs-radius-control);background:var(--gs-surface);color:var(--gs-ink);font:inherit; }
.overview-scope-actions button[aria-pressed=true] { border-color:var(--gs-selected-line);background:var(--gs-selected-bg);color:var(--gs-selected-ink); }
.overview-footer { margin-top:var(--gs-space-section);padding:var(--gs-space-5) 0;border-top:1px solid var(--gs-line);color:var(--gs-ink-3);font-size:var(--gs-text-meta); }
.overview-footer-link { min-height:var(--gs-control-touch);padding:0;border:0;background:none;color:var(--gs-mint-ink);font:inherit;text-decoration:underline;text-underline-offset:3px; }

@media (hover:hover) and (pointer:fine) {
  .overview-heading-chips button:not(:disabled):hover, .overview-story-tabs button:hover { color:var(--gs-ink); }
  .overview-birthdays button:hover strong { color:var(--gs-ink); }
  .overview-icon-button:hover { background:var(--gs-mint-wash); }
  .overview-preferred-actions button:hover { background:var(--gs-hover);color:var(--gs-ink); }
  .overview-search-submit:hover { background:color-mix(in srgb,var(--gs-action-bg) 88%,var(--gs-chrome)); }
  .overview-section-heading button:hover, .overview-personal-meta button:hover, .overview-search-results li > button:hover,
  .overview-story-gateways button:hover strong, .overview-main-index button:hover strong { color:var(--gs-ink); }
  .overview-song-detail:hover strong, .overview-story > button:hover strong, .overview-event > button:hover strong { color:var(--gs-ink); }
  .overview-stage-button:hover, .overview-home-action:hover { color:var(--gs-ink); }
  .overview-unit-tile:hover { background:var(--gs-hover); }
}

/* Narrow page (the shell's middle tier or a phone): the hero spans the row above the cards. */
@container portal (max-width:980px) {
  .overview-almanac { grid-template-columns:minmax(0,1fr);row-gap:var(--gs-space-6); }
  .overview-chip-heading { flex-wrap:wrap;row-gap:var(--gs-space-2); }
  .overview-chip-heading .overview-heading-chips { order:3;flex-basis:100%;margin:0 calc(-1 * var(--gs-space-1)); }
  /* 查看全部 always takes its own line under the month, whatever width the month label has. */
  .overview-month-heading > button { order:3;flex-basis:100%;justify-content:flex-start; }
  .overview-featured { grid-template-columns:minmax(0,1fr);gap:var(--gs-space-section); }
  .overview-personal { display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:center;gap:var(--gs-space-3) var(--gs-space-7); }
  .overview-identity { grid-row:1 / span 2; }
  .overview-content-grid { grid-template-columns:minmax(0,1fr); }
  /* One column: the global page keeps 故事档案 first and splits its song list, as before the two-column row. */
  .is-global-grid .overview-stories { grid-row:1; }
  .is-global-grid .overview-song-list { grid-template-columns:repeat(2,minmax(0,1fr));column-gap:var(--gs-space-8); }
  .overview-event-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .overview-story-hub { gap:var(--gs-space-6); }
  .overview-main-index, .overview-story-gateways { grid-template-columns:minmax(0,1fr); }
  .overview-story-gateways button:last-child:nth-child(odd) { grid-column:auto; }
}
@container portal (max-width:640px) {
  .overview-personal { display:flex;align-items:stretch; }
  .overview-unit-matrix { grid-template-columns:repeat(4,minmax(0,1fr)); }
  .overview-unit-tile { height:84px; }
  .overview-event-grid, .is-global-grid .overview-song-list { grid-template-columns:minmax(0,1fr); }
  .overview-hub-group { grid-template-columns:minmax(0,1fr);gap:0; }
  .overview-hub-group > h3 { padding-bottom:var(--gs-space-2); }
  .overview-event-image { width:112px;height:63px; }
  .overview-scope-actions { grid-template-columns:minmax(0,1fr); }
  .overview-section-heading h2, .overview-section-heading h3 { font-size:var(--gs-text-subtitle); }
}

/* Shell tiers. Middle and phone: tighter gutters, the search on its own row. */
@media (max-width:1100px) {
  .portal-overview { padding:var(--gs-space-5); }
}
/* Phones have no sidebar: 资料馆 and the tools share the first row, the scope chip the second, then
   the search, then the index of every section. */
@media (max-width:760px) {
  .portal-overview { padding:var(--gs-space-3) var(--gs-space-5) var(--gs-space-8); } /* the same 16px side margin as the other pages */
  /* One column at every phone width: the page container's two-column hero (641–980px) would otherwise
     put the hero beside its shortcuts on a large phone, with a hole under the shortcuts. */
  .overview-personal { display:flex;align-items:stretch; }
  .overview-search-form input { font-size:var(--gs-text-subtitle); } /* touch input: 16px or iOS zooms on focus */
  .overview-toolbar { position:static;grid-template-columns:auto minmax(0,1fr) auto;row-gap:var(--gs-space-2);height:auto;padding:var(--gs-space-4) var(--gs-space-5) 0;border-bottom:0; }
  .overview-brand { display:contents; }
  .overview-toolbar-actions { grid-column:3;grid-row:1; }
  .overview-lens { grid-column:1 / -1;grid-row:2;justify-self:stretch;width:100%; }
  .overview-toolbar > .overview-search { grid-column:1 / -1;grid-row:3;max-width:none; }
  .overview-search-results { width:100%; }
  /* Counts are links: two rows of two, each a full touch target, numbers aligned in a column. */
  .overview-footprint { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 var(--gs-space-5);font-size:var(--gs-text-meta); }
  .overview-footprint button { display:flex;align-items:baseline;min-width:0;min-height:var(--gs-control-touch);text-align:left;white-space:nowrap; }
  .overview-footprint b { font-size:var(--gs-text-subtitle); }
  /* Two rows of common destinations, no rules (线框减法册 L2); the cells are ArchiveDirectoryGrid's. */
  .overview-directory { display:block;margin:var(--gs-space-4) 0 0; }
  .overview-panel { margin-top:var(--gs-space-8); }
  .overview-featured { margin-top:var(--gs-space-6); }
  .overview-featured > .overview-directory { margin:calc(var(--gs-space-5) - var(--gs-space-section)) 0 0; } /* hero, then the index close beneath it */
  .overview-story-tabs button, .overview-search-shortcuts > button, .overview-personal-meta button, .overview-section-heading button, .overview-hub-links button { min-height:var(--gs-control-touch); }
  @container portal (max-width:420px) { .overview-hub-links { grid-template-columns:repeat(2,minmax(0,1fr)); } }
}
@media (prefers-reduced-motion:reduce) { .portal-overview :where(button, a) { transform:none !important; } }
</style>
