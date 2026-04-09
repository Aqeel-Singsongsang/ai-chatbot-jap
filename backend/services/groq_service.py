import os
import io
import base64
from typing import Optional
from groq import Groq

class GroqService:
    def __init__(self):
        # API key is automatically picked up from os.environ.get("GROQ_API_KEY")
        # Ensure it is set before instantiating
        self.client = Groq()

    def transcribe_audio(self, audio_bytes: bytes, filename: str, learning_mode: bool = False) -> str:
        """
        Uses whisper-large-v3 to transcribe audio to text.
        If learning_mode is True, we enforce prompt/language guiding to ensure Japanese transcription
        rather than translating Japanese to English/Indonesian.
        """
        prompt_text = "Transcribe the audio exactly. If speaking Japanese, output Japanese characters (kanji/hiragana/katakana) like はい、こんにちは. Do not translate it to English or Indonesian."
        kwargs = {
            "model": "whisper-large-v3",
            "response_format": "text",
            "prompt": prompt_text
        }
        
        # If we are in learning mode, we strictly force the transcription to Japanese
        if learning_mode:
            kwargs["language"] = "ja"
            
        response = self.client.audio.transcriptions.create(
            file=(filename, audio_bytes),
            **kwargs
        )
        # For text response format, it usually returns string directly
        return response

    def generate_chat_reply(self, user_text: str, personality: str, translation_lang: str = "indonesia", history_list: list = None, learning_mode: bool = False) -> str:
        """
        Uses llama-3.3-70b-versatile to generate a response.
        personality can be "ramah" or "pemarah".
        translation_lang decides the language in the parentheses.
        learning_mode imposes a strict Japanese checking constraint.
        history_list is a list of dicts: [{'sender': 'user'|'ai', 'text': '...'}, ...]
        """
        if history_list is None:
            history_list = []
            
        personality_prompt = "Peranmu adalah teman ngobrolku dari Jepang, tetapi kamu juga memiliki TINGKAT KECERDASAN DAN PENGETAHUAN SUPER TINGGI layaknya ChatGPT (tahu segala hal dari sains, koding, hingga filsafat)."
        if personality.lower() == "pemarah":
            personality_prompt += " Walaupun pintar, sifatmu SANGAT PEMARAH, ngegas, tsundere, dan nyolot! Saat menjelaskan informasi atau menjawab pertanyaan, kamu melakukannya sambil marah-marah, protes, atau mengejekku karena aku kurang pintar (gunakan ungkapan bahasa Jepang keras seperti 'baka', 'urusai', 'yaro')."
        elif personality.lower() == "ramah":
            personality_prompt += " Sifatmu SANGAT RAMAH, manis, dan suportif. Saat menjawab pertanyaan rumit, kamu menyampaikannya seperti sahabat pintar yang dengan senang hati dan panjang lebar mengajari temannya."
        
        learning_prompt = ""
        if learning_mode:
            learning_prompt = "\nMODE BELAJAR BAHASA JEPANG AKTIF: TUGAS UTAMAMU ADALAH MENGEVALUASI BAHASA JEPANGKU (ROMAJI/KANA YANG SAYA KETIK). Jika bahasaku bukan bahasa Jepang, omeli dan tolak menjawab. Jika bahasaku adalah bahasa Jepang tetapi tata bahasanya rusak (broken grammar)/typo, kamu HARUS MENGHINA, MENGOMELI, DAN MENGOREKSIKESALAHANKU, tulis TATA BAHASA YANG BENAR DALAM BAHASA JEPANG, baru setelah itu kamu menanggapi obrolan asliku/menjawab."
            
        target_lang = "Bahasa Indonesia yang sangat santai, luwes, dan natural seperti gaya bicara obrolan sehari-hari" if translation_lang.lower() == "indonesia" else "English"
        example_translation = "Halo bodoh! Soekarno itu presiden pertama Indonesia tahu... [lanjutkan terjemahan yang panjang dengan bahasa yang tidak kaku]"
        if translation_lang.lower() == "inggris":
            example_translation = "Hello idiot! Soekarno was the first president of Indonesia... [continue long translation]"
            
        if learning_mode:
            format_rule = "2. BAGIAN ATAS (BAHASA JEPANG TULISAN ASLI): Tulis paragraf penjelasan/jawaban utamamu 100% DALAM TULISAN JEPANG ASLI (Kanji, Hiragana, Katakana).\n"
            char_rule = "5. FURIGANA/HURUF: SETIAP KALI kamu menggunakan karakter KANJI, KAMU WAJIB MENJELASKAN CARA BACANYA (HIRAGANA/KATAKANA) DENGAN FORMAT KURUNG SIKU TEPAT SEPERTI INI: 【Kanji|hiragana】. JANGAN PERNAH MENULIS KANJI SENDIRIAN TANPA FORMAT INI!\n"
            example_format = f"【今日|きょう】は【何|なに】を【勉強|べんきょう】しますか？バカ！スカルノはインドネシアの【初代|しょだい】【大統領|だいとうりょう】でした... [lanjutkan teks jepang yang panjang dengan pola ini]\n\n*Terjemahan:*\n{example_translation}"
        else:
            format_rule = "2. BAGIAN ATAS (BAHASA JEPANG ROMAJI): Tulis paragraf penjelasan/jawaban utamamu 100% DALAM BAHASA JEPANG ROMAJI (Huruf Latin). JANGAN ADA campur aduk teks apapun di sini!\n"
            char_rule = "5. HURUF: DILARANG KERAS MENGGUNAKAN HURUF Kanji / Hiragana / Katakana.\n"
            example_format = f"Konnichiwa baka! Soekarno wa Indonesia no dai ichi daigensui deshita... [lanjutkan teks jepang yang panjang]\n\n*Terjemahan:*\n{example_translation}"
            
        # Adding constraints for text presentation
        system_prompt = (
            f"{personality_prompt}{learning_prompt}\n"
            "ATURAN KETAT DAN MUTLAK! (JIKA DILANGGAR MAKA FATAL): \n"
            "1. FORMAT RESPON: Bagikan balasanmu HANYA menjadi 2 bagian terpisah secara paragraf.\n"
            f"{format_rule}"
            f"3. BAGIAN BAWAH (TERJEMAHAN {target_lang.upper()}): Beri jarak dua baris kosong (Enter), lalu tuliskan '*Terjemahan:*' diikuti oleh teks terjemahan lengkapnya seutuhnya dalam {target_lang}.\n"
            "4. WAWASAN TINGGI: Berikan penjelasan yang mendalam dan panjang lebar sesuai peranmu jika ditanya pertanyaan pintar.\n"
            f"{char_rule}"
            "CONTOH FORMAT YANG DIHARAPKAN:\n"
            f"{example_format}"
        )

        messages_payload = [{"role": "system", "content": system_prompt}]
        
        # Inject memory context
        for msg in history_list[-20:]:  # Keep last 20 messages to save context limits
            role = "user" if msg.get("sender") == "user" else "assistant"
            messages_payload.append({"role": role, "content": msg.get("text", "")})
            
        # Add the newest message
        messages_payload.append({"role": "user", "content": user_text})

        chat_completion = self.client.chat.completions.create(
            messages=messages_payload,
            model="llama-3.3-70b-versatile",
            max_tokens=1024,
            temperature=0.7
        )

        return chat_completion.choices[0].message.content

    def generate_speech(self, text: str) -> str:
        """
        Uses canopylabs/orpheus-v1-english to generate audio from text.
        Returns base64 encoded audio.
        """
        # Ensure text is slightly below 200 if needed, but our prompt should handle it.
        text_to_speak = text[:200]
        
        response = self.client.audio.speech.create(
            model="canopylabs/orpheus-v1-english",
            voice="autumn", # Supported voices: autumn, diana, hannah, austin, daniel, troy
            input=text_to_speak,
            response_format="wav"
        )
        
        # The response from audio.speech might come back as raw bytes.
        # Check Groq SDK docs: usually response.content or equivalent.
        # But according to standard python openai-like client, read() or iter_bytes()
        audio_content = response.read()
        return base64.b64encode(audio_content).decode("utf-8")

groq_service = GroqService()
