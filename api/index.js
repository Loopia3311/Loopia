const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// API 路由：上架商品（已更新類別：電子產品、書籍、家居、其他）
app.post('/api/create-product', async (req, res) => {
    let { imageBase64, category, condition_status, region, extraDescription, sellerContact } = req.body;
    
    // 檢查類別，若不在允許範圍內則預設為「其他」（已移除母嬰玩具）
    const allowedCategories = ['電子產品', '書籍', '家居', '其他'];
    if (!allowedCategories.includes(category)) {
        category = '其他';
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                { inlineData: { mimeType: 'image/jpeg', data: imageBase64.split(',')[1] } },
                '分析商品並回傳 JSON 格式: {"title": "商品名稱", "suggestedPrice": 數字價格, "description": "簡短描述"}'
            ]
        });

        const aiData = JSON.parse(response.text.replace(/```json|```/g, ''));
        
        const { data, error } = await supabase.from('products').insert([{ 
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
        res.status(500).json({ success: false, error: err.message });
    }
});

// API 路由：取得商品列表（供訪客瀏覽）
app.get('/api/products', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = app;