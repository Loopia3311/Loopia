const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
// 提高限制到 25mb，並確保解析器能處理大型請求
app.use(express.json({ limit: '25mb' }));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post('/api/create-product', async (req, res) => {
    try {
        let { imageBase64, category, condition_status, region, extraDescription, sellerContact } = req.body;
        
        if (!imageBase64) return res.status(400).json({ success: false, error: '未獲取圖片數據' });

        const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
                '分析此商品圖，僅回傳 JSON: {"title": "名稱", "suggestedPrice": 價格, "description": "簡短介紹"}'
            ]
        });

        const aiData = JSON.parse(response.text.replace(/```json|```/g, '').trim());
        
        await supabase.from('products').insert([{ 
            title: aiData.title, 
            price: Number(aiData.suggestedPrice), 
            description: `${aiData.description}\n\n【補充】${extraDescription || ''}`,
            category, condition_status, region, seller_contact: sellerContact
        }]);

        res.json({ success: true });
    } catch (err) {
        console.error('API Error:', err);
        res.status(500).json({ success: false, error: 'AI 分析失敗，請嘗試較小的圖片' });
    }
});

app.get('/api/products', async (req, res) => {
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    res.json({ success: true, data: data || [] });
});

module.exports = app;