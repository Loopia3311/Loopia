const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// API 路由
app.post('/api/create-product', async (req, res) => {
    const { imageBase64, category, condition_status, region, extraDescription, sellerContact } = req.body;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ inlineData: { mimeType: 'image/jpeg', data: imageBase64.split(',')[1] } },
                '分析商品並回傳 JSON: {title, suggestedPrice, description}']
        });

        const aiData = JSON.parse(response.text.replace(/```json|```/g, ''));
        const { data, error } = await supabase.from('products').insert([{ 
            title: aiData.title, 
            price: Number(aiData.suggestedPrice), 
            description: `${aiData.description}\n\n【補充】${extraDescription}`,
            category, condition_status, region, seller_contact: sellerContact
        }]);

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/products', async (req, res) => {
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    res.json({ success: true, data });
});

module.exports = app;