"""Client cut boundaries (サイスタ 2.6.10).

ScenarioController.SetCutDataList appends each command to the current cut and
starts a new cut after any command whose GetCutEnd() is true:

* TextCommandData.GetCutEnd (RVA 0x211b044): every text command except
  text_select (5), text_disable (8) and image_icon (9). That includes `wait`
  (15), so a wait always closes its cut.
* EffectCommandData.GetCutEnd (RVA 0x235dd54): mask 0x40f, i.e. screen_fadein,
  screen_fadeout, screen_slidein, screen_slideout and screen_fadecolor.
* JumpCommandData.GetCutEnd (RVA 0x2473a3c): every jump command but jump_point.
* Everything else uses ScenarioDataBase.GetCutEnd, which is false.

`wait N` sets StoryView+0xe4 (TextCommandAction case 0xf); PlayView starts
NextCutWaitCoroutine, which counts it down by deltaTime * speed, and
WaitAnimationEnd holds the cut until it reaches 0 alongside the cut's other
animations. A tap (OnClickBackgroundPanel) or skip clears it. A cut holding only
a wait therefore keeps the screen as it is for N seconds.
Enum names are from the il2cpp dump (TextCommandData/EffectCommandData/
JumpCommandData.CommandType).
"""

from __future__ import annotations

TEXT_COMMANDS = (
    'text', 'text_se_off', 'text_time', 'text_title', 'text_log', 'text_select', 'text_synopsis',
    'text_producer', 'text_disable', 'image_icon', 'phone_text', 'phone_select', 'talk_text',
    'talk_stamp', 'talk_select', 'wait', 'tutorial_name_imput',
)
TEXT_NOT_CUT_END = frozenset({'text_select', 'text_disable', 'image_icon'})
EFFECT_CUT_END = frozenset({'screen_fadein', 'screen_fadeout', 'screen_slidein', 'screen_slideout', 'screen_fadecolor'})
JUMP_COMMANDS = ('jump_point', 'jump', 'cut_end', 'talk_start', 'phone_start', 'talk_end', 'phone_end', 'live', 'lounge_end')


def is_cut_end(command_type: str) -> bool:
    if command_type in TEXT_COMMANDS:
        return command_type not in TEXT_NOT_CUT_END
    if command_type in EFFECT_CUT_END:
        return True
    if command_type in JUMP_COMMANDS:
        return command_type != 'jump_point'
    return False


def wait_seconds(values: list) -> float:
    """StoryView reads the wait as a float; an empty or bad value is no wait."""
    try:
        return max(0.0, float(values[0])) if values else 0.0
    except (TypeError, ValueError):
        return 0.0
