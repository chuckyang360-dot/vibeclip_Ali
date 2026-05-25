REFERENCE_VIDEO_UNDERSTANDING_SYSTEM_PROMPT = """你是专业短视频导演、广告片拆解师和视频生成提示词工程师。
用户上传参考视频，是为了复刻这条视频的内容结构、视觉风格、镜头节奏和生成方式。
你的任务不是做视频摘要，而是根据原视频本身生成一份可用于复刻生产的完整视频蓝图。

必须遵守：
1. 按原视频真实发生的镜头、场景、人物动作、产品露出、字幕/声音、剪辑变化来拆解。
2. 必须从视频开始到结束连续覆盖原视频内容，不要只选择代表性片段，不要跳过中间内容。
3. 不要人为规定分镜数量，不要按固定秒数切分，不要为了凑数量拆分，也不要为了简化合并不同镜头。
4. 每个拆出的真实镜头/片段都必须有独立的生成 PMT，便于用户替换产品、人物或场景后逐段生成并合成。
5. 剧本结构必须识别原视频实际结构，不要套用固定营销模板。
6. 只描述视频中能观察到的事实；合理推断要标明为推断。
7. 不要臆造看不清的品牌、字幕、功效、价格、平台信息。
8. 所有面向用户展示的内容必须使用中文；JSON key 可以是英文，但 value 不要中英文混杂。
9. 时间段格式使用 MM:SS-MM:SS；如果只能估计时间码，需要保持连续覆盖并标明为近似。
10. 输出必须是严格 JSON，不要 Markdown，不要代码块。
"""


def build_reference_video_understanding_payload(video_url: str) -> dict:
    return {
        "task": "reference_video_deconstruction",
        "video_url": video_url,
        "output_language": "zh-CN",
        "required_json_schema": {
            "video_recreation_overview": {
                "what_to_recreate": "这条视频真正值得复刻的内容结构、视觉风格和镜头节奏",
                "overall_style": "整条视频的统一视觉风格",
                "rhythm": "剪辑节奏、镜头衔接和情绪推进方式",
                "replacement_strategy": "用户替换产品、人物或场景时，应保留和可替换的部分",
            },
            "script_reading": {
                "summary": "这个视频在讲什么",
                "core_message": "核心表达",
                "emotional_tone": "情绪/氛围",
                "audience_takeaway": "观众看完会记住什么",
            },
            "shooting_method": {
                "overall_style": "整体拍法",
                "camera": ["景别、机位、运动方式"],
                "lighting": ["光线与色彩"],
                "composition": ["构图与画面组织"],
                "editing": ["剪辑节奏与转场"],
                "sound": ["音乐、口播、环境声、字幕节奏"],
            },
            "actual_script_structure": {
                "structure_type": "根据原视频识别出来的真实结构类型",
                "is_marketing_structure": "boolean",
                "segments": [
                    {
                        "time_range": "MM:SS-MM:SS",
                        "role_in_video": "这一段在原视频里的叙事作用",
                        "description": "这一段发生了什么",
                        "evidence": "判断依据",
                    }
                ],
                "notes": "结构说明，不要硬套固定模板",
            },
            "characters": [
                {
                    "time_range": "MM:SS-MM:SS",
                    "role": "人物身份/角色功能",
                    "appearance": "外观、年龄感、穿搭等可见信息",
                    "emotion_and_action": "情绪与动作",
                    "inference_notes": "不确定或推断说明",
                }
            ],
            "product_presentation": [
                {
                    "time_range": "MM:SS-MM:SS",
                    "presentation_method": "产品如何出现/展示/被使用",
                    "visible_features": ["可见特征"],
                    "selling_point_signal": "视频中暗示的卖点；不确定则标明",
                    "integration_with_story": "产品与剧情/场景的关系",
                }
            ],
            "shot_breakdown": [
                {
                    "shot_id": "S01",
                    "time_range": "MM:SS-MM:SS",
                    "scene": "场景",
                    "character": "人物/无人物",
                    "product": "产品露出/无产品露出",
                    "action": "这一段发生了什么",
                    "camera": "镜头、景别、机位、运镜",
                    "lighting": "光线和色彩",
                    "composition": "构图",
                    "subtitle_or_audio": "字幕、旁白、音乐或声音",
                    "purpose": "这一段在原视频里的作用",
                    "recreate_prompt": "这一段独立视频生成 PMT，包含场景、人物、动作、产品、镜头、光线、风格和时长感",
                    "replaceable_parts": {
                        "product": "产品替换说明",
                        "character": "人物替换说明",
                        "scene": "场景替换说明",
                    },
                }
            ],
            "segment_prompts": [
                {
                    "shot_id": "S01",
                    "time_range": "MM:SS-MM:SS",
                    "prompt": "可复制的单段视频生成 PMT，必须对应同 shot_id 的真实片段",
                    "negative_prompt": "这一段不希望出现的内容",
                    "continuity_note": "和前后镜头的衔接注意点",
                }
            ],
            "global_style_prompt": {
                "style_bible": "整条视频需要统一保留的风格设定",
                "global_negative_prompt": "全局负面词",
                "assembly_notes": "逐段生成后如何保持一致并合成",
            },
            "uncertainty_notes": ["无法确认或看不清的内容"],
            "copyright_safety_notes": ["版权和合规提醒"],
        },
    }
