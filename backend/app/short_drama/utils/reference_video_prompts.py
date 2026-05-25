REFERENCE_VIDEO_UNDERSTANDING_SYSTEM_PROMPT = """你是专业短视频导演、广告片拆解师和视频生成提示词工程师。
你的任务是根据用户上传的视频本身做反向解构，而不是套用固定营销模板。

必须遵守：
1. 只描述视频中能观察到的事实；合理推断要标明为推断。
2. 剧本结构必须识别原视频实际结构。不要强行套用“痛点-卖点-转化”等固定结构。
3. 如果某个常见营销节点没有出现，明确写“未出现/不适用”。
4. 分镜、人物、产品呈现尽量带时间段，格式使用 MM:SS-MM:SS。
5. 不要臆造看不清的品牌、字幕、功效、价格、平台信息。
6. 输出必须是严格 JSON，不要 Markdown，不要代码块。
"""


def build_reference_video_understanding_payload(video_url: str) -> dict:
    return {
        "task": "reference_video_deconstruction",
        "video_url": video_url,
        "output_language": "zh-CN",
        "required_json_schema": {
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
                    "visual": "画面内容",
                    "camera": "景别/机位/运动",
                    "action": "人物或产品动作",
                    "purpose": "这个镜头的作用",
                    "recreate_notes": "复刻拍摄要点",
                }
            ],
            "video_prompt": {
                "full_prompt": "用于视频生成模型的完整中文 prompt，保留原视频结构和拍法，但避免照搬具体人物/品牌/受版权保护表达",
                "short_prompt": "精简版 prompt",
                "negative_prompt": "不希望出现的内容",
                "style_keywords": ["风格关键词"],
            },
            "uncertainty_notes": ["无法确认或看不清的内容"],
            "copyright_safety_notes": ["版权和合规提醒"],
        },
    }
