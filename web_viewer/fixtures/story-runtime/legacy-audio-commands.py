"""Frozen f80f5aa audio handlers for migration parity only."""
class LegacyAudioCommands:
    def _bgm(self, vals: list):
        """Values: [cue_id, ...] — empty vals means stop.
        'no_bgm' is a special keyword meaning no BGM should play.
        """
        if vals and vals[0] and vals[0] != 'no_bgm':
            self.state.set_bgm(vals[0])
            self._bgm_from_advbackground = False
        else:
            self.state.stop_bgm()
            self._bgm_from_advbackground = False
        self._mark_stage_change()

    def _bgm_stop(self, vals: list):
        """BGM stop with optional fade duration.
        Values: [fade_duration?, ...]
        """
        fade = float(vals[0]) if vals and vals[0] else 0
        self.state.stop_bgm()
        self._bgm_from_advbackground = False
        self.state.bgm_stop_fade = fade
        self._mark_stage_change()

    def _se(self, vals: list):
        """Sound effect — one-shot audio.
        Values: [cue_name, delay?, ...]
        """
        if vals and vals[0]:
            event = {"cue": vals[0]}
            if len(vals) > 1 and vals[1]:
                event["delay"] = self._safe_float(vals[1], 0.0)
            self.state.se = event
            self.state.se_events.append(event)
            self._mark_stage_change()

    def _se_stop(self, vals: list):
        """Stop SE playback (not commonly used, but supported)."""
        self.state.se = None
        self.state.se_events = []
        self._mark_stage_change()

    def _environmental(self, vals: list):
        """Looping ambient audio — crossfades from previous.
        Values: [main_cue, fade_cue?, ..., volume?, state?, ...]
        vals[0]=main_cue, vals[1]=crossfade_to_cue, vals[3]=volume
        """
        if vals and vals[0]:
            env = {"cue": vals[0]}
            if len(vals) > 3 and vals[3]:
                try:
                    env["volume"] = float(vals[3])
                except ValueError:
                    env["volume"] = None
            self.state.environmental = env
            self._environmental_from_advbackground = False
            self._mark_stage_change()

    def _environmental_stop(self, vals: list):
        """Stop ambient with fade.
        Values: [fade_seconds, ...]
        """
        self.state.environmental = None
        self._environmental_from_advbackground = False
        self._mark_stage_change()

    def _environmental_volume(self, vals: list):
        """Set ambient volume directly.
        Values: [volume?, ...]
        """
        if vals and vals[0]:
            try:
                vol = float(vals[0])
                if self.state.environmental:
                    self.state.environmental["volume"] = vol
                    self._mark_stage_change()
            except ValueError:
                pass

    def _environmental_ducking(self, vals: list):
        """Duck/attenuate environmental audio.
        Values: [target_volume?, ...] — 0=full duck (mute), 0.5=half volume.
        Sets environmental_duck_target on state (one-shot, consumed by next snapshot).
        """
        if vals and vals[0]:
            try:
                self.state.environmental_duck_target = float(vals[0])
                self._mark_stage_change()
            except ValueError:
                pass
