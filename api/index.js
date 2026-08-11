const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post('/api/create-product', async (req, res) => {
    try {
        let { imageBase64, category, condition_status, region, extraDescription, sellerContact } = req.body;
        
        if (!imageBase64) return res.status(400).json({ success: false, error: '未獲取圖片數據' });

        const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

        let aiData = { title: "二手精選商品", suggestedPrice: 500, description: "品質良好，歡迎詢問。" };

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                    { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
                    '分析此商品圖片，嚴格僅回傳純 JSON 格式（不要包覆 markdown）： {"title": "商品名稱", "suggestedPrice": 數字價格, "description": "簡短介紹"}'
                ]
            });
            const cleanText = response.text.replace(/```json|```/g, '').trim();
            aiData = JSON.parse(cleanText);
        } catch (aiErr) {
            console.warn('AI 解析失敗，使用預設值替代:', aiErr);
        }
        
        const { error } = await supabase.from('products').insert([{ 
            title: aiData.title, 
            price: Number(aiData.suggestedPrice) || 100, 
            description: `${aiData.description || ''}\n\n【補充說明】${extraDescription || ''}`,
            category: category || '其他好物', 
            condition_status: condition_status || '九成新', 
            region: region || '全台灣', 
            seller_contact: sellerContact || 'contact@loopia.com'
        }]);

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('API Error:', err);
        res.status(500).json({ success: false, error: err.message || '伺服器處理失敗' });
    }
});

app.get('/api/products', async (req, res) => {
    try {
        const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, data: data || [] });
    } catch (err) {
        res.status(500).json({ success: false, data: [] });
    }
});

module.exports = app;