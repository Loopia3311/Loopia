const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// API 路由：上架商品
app.post('/api/create-product', async (req, res) => {
    try {
        let { imageBase64, category, condition_status, region, extraDescription, sellerContact } = req.body;
        
        const allowedCategories = ['電子產品', '書籍', '家居', '其他'];
        if (!allowedCategories.includes(category)) {
            category = '其他';
        }

        if (!imageBase64) {
            return res.status(400).json({ success: false, error: '未上傳圖片' });
        }

        const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
                '請分析這張商品圖片，並嚴格只回傳 JSON 格式（不要有 markdown 語法），包含以下欄位: {"title": "商品名稱", "suggestedPrice": 數字價格, "description": "簡短描述"}'
            ]
        });

        let textResponse = response.text.trim();
        textResponse = textResponse.replace(/```json|```/g, '').trim();
        const aiData = JSON.parse(textResponse);
        
        const { error } = await supabase.from('products').insert([{ 
            title: aiData.title, 
            price: Number(aiData.suggestedPrice), 
            description: `${aiData.description}\n\n【補充說明】${extraDescription || ''}`,
            category, 
            condition_status, 
            region, 
            seller_contact: sellerContact
        }]);

        if (error) throw error;
        res.json({ success: true, message: '商品上架成功！' });
    } catch (err) {
        console.error('上架錯誤:', err);
        res.status(500).json({ success: false, error: err.message || '伺服器發生未預期的錯誤' });
    }
});

// API 路由：取得商品列表
app.get('/api/products', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ success: true, data: data || [] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = app;