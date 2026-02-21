ASIN 详情
Support MCP
version

v1
ASIN的详情页面上各种信息集中展示，如上架日期，BSR排名，A+等等各种信息
获取密钥
Http Method	GET
Http Request URL	https://api.sellersprite.com/v1/asin/{marketplace}/{asin}
-> 请求参数
折叠
#	参数	参数类型	是否必填	参数名称	参数描述
1	marketplace	String	✓	市场	见表 1.2
2	asin	String	✓	asin	B08GHW4TBS
返回参数 <-
折叠
#	参数	参数类型	参数名称	参数描述
1	asin	String	asin	B08GHW4TBS
2	asinUrl	String	asin url	https://www.amazon.com/dp/B08GHW4TBS
3	availableDate	Long	上架日期	1609059137000
4	badge	Badge	标识	包括了下面 5 个标识
5	└bestSeller	String	Best Seller 标识	Y 或者 N
6	└amazonChoice	String	amazon choice 标识	Y 或者 N
7	└newRelease	String	release 标识	Y 或者 N
8	└ebc	String	A+页面	Y 或者 N
9	└video	String	视频介绍	Y 或者 N
10	brand	String	品牌	mermaker
11	brandUrl	String	品牌 URL	/stores/Mermaker/page/984A6448-1C68-4CCA-AD5A-D574EA2D65D5?ref_=ast_bln
12	bsrId	String	bsr id	home-garden
13	bsrLabel	String	bsr 标签	Home & Kitchen
14	bsrRank	Integer	bsr 排名	1006
15	createdTime	Long	创建时间	1606467137000
16	dimensions	String	尺寸	7 x 6 x 0.6 inches
17	firstRatingDate	Long	第一次评论时间	1609059137000
18	imageUrl	String	图片链接	https://images-na.ssl-images-amazon.com/images/I/412616zl5YL .AC_US200.jpg
19	lqs	Integer	Listing 页面质量得分	97
20	nodeId	String	节点 id	1063280
21	nodeIdPath	String	节点 id 串	1055398:1063252:1063280
22	nodeLabelPath	String	类目名称串	Home & Kitchen:Bedding:Blankets & Throws
23	nodeLabelPathLocale	String	类目名称串中文	家居厨房用品:床上用品:毯子、盖毯
24	parent	String	父 asin	B07V5GB9B5
25	price	Float	价格	21.99
26	questions	Integer	问题数量	5
27	rating	Float	评分	4.8
28	ratings	Integer	评分数	29229
29	reviews	Integer	评论数	9229
30	variantRatings	Integer	子体评分数	12454
31	variantReviews	Integer	子体评论数	3211
32	sellerId	String	卖家 id	A13AJ1GXFINAZ
33	sellerName	String	卖家名称	Mermaker
34	fulfillment	String	配送方式	FBA
35	sellers	Integer	卖家数	1
36	skuList	List	sku	["Color: Beige","Size: 47 inches"]
37	marketplace	String	String	见表 1.2
38	title	String	标题	mermaker Burritos Tortilla Blanket 2.0 Double Sided 47 inches for Adult and Kids,Giant Funny Realistic Food Throw Blanket,285 GSM Novelty Soft Flannel Taco Blanket (Yellow Blanket-Double Sided)
39	features	List	五点描述	
40	overviews	String	详情，json格式字符串	
41	updatedTime	Long	更新时间	1609059137000
42	variationList	List	变体	[{"asin":"B07V5GB9B5","attribute":"Beige"},{"asin":"B08H86SSSF","attribute":"Cookie"}]
43	variations	Integer	变体数量	14
44	weight	String	重量	15.2 ounces
45	zoomImageUrl	String	大图 URL	https://images-na.ssl-images-amazon.com/images/I/412616zl5YL .AC_US600.jpg
46	subcategories	Object	子类目信息	
47	└rank	Integer	子类目排名	1
48	└code	String	子类目code	17874234011
49	└label	String	子类目标签	Kids' Throw Blankets
50	deliveryPrice	Float	卖家运费,-1表示没有	4
51	primePrice	Float	prime价格，-1表示没有	42
52	coupon	String	优惠卷	[save $20]
53	└amazonChoice	String	amazon choice 标识	Y 或者 N
-> 请求示例
折叠
curl --location --request GET 'https://api.sellersprite.com/v1/asin/US/B0DRVKZHK9' \
--header 'secret-key: Your Secret'
Shell
返回示例 <-
折叠
{
    "code": "OK",
    "message": "成功",
    "data": {
        "asin": "B0DRVKZHK9",
        "asinUrl": "https://www.amazon.com/dp/B0DRVKZHK9?th=1",
        "availableDate": 1710345600000,
        "brand": "Yitrust",
        "brandUrl": "/stores/Yitrust/page/3440BDBD-A6C1-4DA6-800B-4EDA16B2F347?ref_=ast_bln&store_ref=bl_ast_dp_brandLogo_sto",
        "bsrId": "beauty",
        "bsrLabel": "Beauty & Personal Care",
        "bsrRank": 58102,
        "subcategories": [{
            "rank": 136,
            "code": "11058221",
            "label": "Hot-Air Hair Brushes"
        }],
        "createdTime": 1735855239000,
        "dimensions": "1 x 1 x 1 inches",
        "firstRatingDate": null,
        "imageUrl": "https://m.media-amazon.com/images/I/4182p-TslhL._AC_US200_.jpg",
        "lqs": 100,
        "nodeId": 11058221,
        "nodeIdPath": "3760911:11057241:11058091:11058221",
        "nodeLabelPath": "Beauty & Personal Care:Hair Care:Styling Tools & Appliances:Hot-Air Brushes",
        "nodeLabelPathLocale": null,
        "parent": "B0DRVKZHK9",
        "price": 73.99,
        "primePrice": -1.0,
        "deliveryPrice": -1.0,
        "coupon": "",
        "questions": null,
        "rating": 4.6,
        "ratings": 13,
        "reviews": null,
        "variantRatings": null,
        "variantReviews": null,
        "sellerId": "A3RB0UBY5ZAEAH",
        "sellerName": "Yitrust",
        "fulfillment": "FBA",
        "sellers": 1,
        "marketplace": "US",
        "title": "6 in 1 Blow Dryer Brush, Hair Dryer with Diffuser for Curly Hair, Negative Ionic Hair Dryer Brush Set, Air Curling Iron Air Styler, Brush Blow Dryer Straight, Volumize, Drying Hair Styling Tool",
        "updatedTime": 1740475874000,
        "variations": 2,
        "weight": "2.49 Pounds",
        "zoomImageUrl": "https://m.media-amazon.com/images/I/4182p-TslhL._AC_US600_.jpg",
        "skuList": [
            "Color: Black"
        ],
        "variationList": [{
                "asin": "B0CY5J4PKN",
                "attribute": "Color: Black"
            },
            {
                "asin": "B0CY56HG53",
                "attribute": "Color: Blue"
            }
        ],
        "features": [
            "NEW UPDATE 6 IN 1 HAIR DRYER BRUSH: The hair dryer brush set new with diffuser for women comes with 6 interchangeable brush attachments that make 1*narrow hairdryer head, 2* left/right direction air hair wrapping curling iron, 1*hair straightener brush, 1* volumizing brush, 1*hair dryer with diffuser. Hair dryer brush blow dryer brush in one provides the perfect for creating different hairstyles for different hair lengths. The exquisite packaging to give to your friends.",
            "3 TEMPERATURE SETTING FOR ALL HAIR: 120°F- 220°F / 50°C- 105°C, Brush blow dryer supplies 1000W of power, 3 temperature settings to adjust the heat, suitable for different hair types. 1. I: Low Temp, for dry hair / fine hair. 2. II: Medium Temp, for semi-dry hair / normal hair. 3. III: High Temp, for wet hair / thick and curly hair, hot air brush settings allow you to customize your styling experience based on your hair type and the season, ensuring you achieve the perfect look every time.",
            "NEGATIVE IONIC HOT AIR BRUSH: The automatic hair curler releases thousands of negative ion airflows to care for your hair during drying. Hair dryer brush blow dryer brush in one adopts a ceramic coating process to smooth the static frizz effectively. Curling brush allow you get luxury salon hair care without heat damage, increase your hair shinny & healthy.",
            "TIPS FOR USTING AIR CURLER AIR STYLER: 1. Hold a small section of hair about 10cm from the tips. 2. Bring the hair toward the barrel, hair will begin to wrap. 3. Must be Start wrap from the hair tips. 4. Create tension and bring towards your head. 5. Hold in place for 15s. 6. Turn off and release. The usage of hot air curling sticks is different from the regular curling sticks. If you are confused during use, please contact us and we will provide you with professional service support.",
            "SAFETY & CONVENIENCE: Our designed with your safety in mind, this Hair brush blow dryer features a standard US ALCI safety plug with auto leakage protection. The handle is designed to withstand high temperatures, ensuring durability and peace of mind. Additionally, we recommend using anti-scalding gloves when changing the removable blow head to prevent burns. The initial use may produce a slight odor, which is normal and will dissipate quickly."
        ],
        "overviews": "{\"Brand\":\"Yitrust\",\"Color\":\"Black\",\"Material\":\"Plastic\",\"Wattage\":\"1000 watts\",\"Power Source\":\"Corded Electric\"}",
        "badge": {
            "bestSeller": "N",
            "amazonChoice": "N",
            "newRelease": "N",
            "ebc": "Y",
            "video": "Y"
        }
    }
}