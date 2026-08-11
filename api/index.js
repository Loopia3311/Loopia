const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// AI 智慧上架 API
app.post('/api/create-product', async (req, res) => {
    const { imageBase64, category, condition_status, region, extraDescription, sellerContact } = req.body;
    try {
        if (!imageBase64) return res.status(400).json({ success: false, error: '請提供商品圖片' });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                {
                    inlineData: {
                        mimeType: 'image/jpeg',
                        data: imageBase64.replace(/^data:image\/\w+;base64,/, '')
                    }
                },
                '請分析這張二手商品圖片。回傳格式必須是純 JSON，包含三個欄位：title (商品名稱，繁體中文)、suggestedPrice (建議二手售價的數字，不要有逗號或文字)、description (溫馨且吸引人的商品描述與品相評估)。絕對不要包含任何 markdown 語法標籤或 ```json 字樣。'
            ]
        });

        let rawText = response.text.trim();
        rawText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');

        let aiData;
        try {
            aiData = JSON.parse(rawText);
        } catch (e) {
            aiData = { 
                title: "智慧二手好物", 
                suggestedPrice: 400, 
                description: "由 AI 精心審視的優質二手商品，歡迎詢問。" 
            };
        }

        // 組合 AI 描述與使用者補充的內容
        let finalDescription = aiData.description;
        if (extraDescription && extraDescription.trim() !== '') {
            finalDescription += `\n\n【賣家補充說明】${extraDescription.trim()}`;
        }

        const { data, error } = await supabase
            .from('products')
            .insert([{ 
                title: aiData.title, 
                price: Number(aiData.suggestedPrice) || 400, 
                description: finalDescription,
                category: category || '其他',
                condition_status: condition_status || '幾乎全新',
                region: region || '高雄市鼓山區',
                seller_contact: sellerContact || '匿名賣家'
            }])
            .select();

        if (error) throw error;
        res.json({ success: true, data: data[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 取得商品列表 API
app.get('/api/products', async (req, res) => {
    try {
        const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 刪除商品 API
app.delete('/api/delete-product', async (req, res) => {
    const { id } = req.query;
    try {
        if (!id) return res.status(400).json({ success: false, error: '缺少商品 ID' });
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = app;