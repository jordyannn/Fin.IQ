# -*- coding: utf-8 -*-
"""Kamus per subkategori untuk dataset sintetis Fin.IQ (Bahasa Indonesia).

Format baris: R(parent, sub, items, merchants, lo, hi, verbs, typ)
 - items     : frasa benda/predikat dipisah '|'
 - merchants : nama tempat/merchant (expense) atau pihak pembayar (income) dipisah '|'
 - lo, hi    : rentang nominal rupiah
 - verbs     : kata kerja khusus (dipisah ','); kosong = default
 - typ       : harga 'umum' (dipisah ','); dipakai ~55% kalau diisi
"""

KIND = {
    "Makanan & Minuman": "expense",
    "Transportasi": "expense",
    "Belanja & Belanjaan": "expense",
    "Hiburan & Rekreasi": "expense",
    "Kebutuhan Rumah": "expense",
    "Kesehatan & Medis": "expense",
    "Pendidikan & Karir": "expense",
    "Tagihan & Finansial": "expense",
    "Gaji & Penghasilan Kerja": "income",
    "Investasi & Finansial": "income",
    "Hadiah & Rezeki": "income",
    "Pemasukan Lainnya": "income",
}

ROWS = []


def R(parent, sub, items, merch, lo, hi, verbs="", typ=""):
    ROWS.append(dict(
        parent=parent, sub=sub, kind=KIND[parent],
        items=[x.strip() for x in items.split("|") if x.strip()],
        merch=[x.strip() for x in merch.split("|") if x.strip()],
        lo=lo, hi=hi,
        verbs=[x.strip() for x in verbs.split(",") if x.strip()],
        typ=[int(x) for x in typ.split(",") if x.strip()],
    ))


# ======================= MAKANAN & MINUMAN =======================
P = "Makanan & Minuman"
R(P, "Restoran",
  "nasi goreng seafood|ayam bakar madu|sate kambing|soto betawi|iga bakar|gurame goreng|steak tenderloin|ramen|sushi set|dimsum|bebek goreng|seafood satu meja|nasi liwet komplit|ikan bakar|rendang dan nasi|sop buntut|gudeg komplit|bakso urat|kwetiau seafood|nasi padang komplit|pempek komplit|rawon|bill makan malam|tagihan restoran|makan malam keluarga|makan siang bareng klien|buffet|all you can eat|shabu-shabu|yakiniku|dim sum keluarga|tongseng",
  "Sederhana|Pondok Gurih|Sate Khas Senayan|Bebek Kaleyo|Solaria|Sushi Tei|Ichiban Sushi|Bakmi GM|Waroeng SS|Ayam Penyet Surabaya|Mie Gacoan|Bakso Boedjangan|Hokben|Yoshinoya|Imperial Kitchen|restoran Padang|resto seafood|rumah makan Sunda|resto Jepang",
  25000, 450000, "makan,bayar,pesen,traktir")
R(P, "Makan Harian",
  "nasi warteg|nasi campur|nasi uduk|lontong sayur|bubur ayam|nasi kuning|gado-gado|soto ayam|mie ayam|bakso|pecel lele|nasi telur|ketoprak|lotek|nasi kucing|siomay|batagor|sarapan|makan siang|makan malam|jajan sore|cilok|seblak|martabak telor|gorengan|kebab|nasi bungkus|katering harian|langganan katering|lauk pauk|nasi ayam geprek|mie rebus|nasi pecel|bakmi|ayam goreng warteg",
  "warteg|kantin kantor|kantin kampus|warung Bu Siti|angkringan|gerobak depan kantor|warung tegal|GrabFood|GoFood|ShopeeFood|warung Padang|warung depan",
  8000, 45000, "beli,bayar,jajan,pesen,order")
R(P, "Makanan Cepat Saji",
  "paket ayam goreng|burger|kentang goreng|nasi ayam crispy|paket hemat|chicken wings|ayam geprek|kebab|sandwich|hotdog|nugget|corn dog|fried chicken|paket panas|spaghetti fast food|combo burger|rice bowl|chicken burger|paket berdua|snack box",
  "KFC|McD|McDonald's|Burger King|A&W|Richeese Factory|Texas Chicken|Hokben|CFC|Popeyes|Kebab Turki Baba Rafi|Geprek Bensu|Subway|Wendy's",
  15000, 120000, "beli,bayar,jajan,pesen,order")
R(P, "Kopi & Minuman",
  "es kopi susu|americano|latte|cappuccino|matcha latte|boba|es teh manis|thai tea|es jeruk|kopi tubruk|jus alpukat|milkshake|cold brew|chocolate hazelnut|kopi hitam|es cendol|susu kedelai|brown sugar boba|lemon tea|es kelapa muda|smoothie|kopi sachet|es campur|kopi susu gula aren|teh tarik|flat white|piccolo|es teh poci",
  "Kopi Kenangan|Janji Jiwa|Starbucks|Fore Coffee|Kopi Tuku|Chatime|Xing Fu Tang|Tomoro Coffee|Point Coffee|Kopi Soe|Esteh Indonesia|Haus|Kopi Lain Hati|warkop|Maxx Coffee|Gong Cha|Mixue|kafe deket kantor",
  10000, 75000, "beli,ngopi,jajan,pesen,order,bayar")
R(P, "Bar & Minuman",
  "bir|cocktail|whisky|bottle service|wine|soju|craft beer|happy hour|minuman di bar|segelas wine|vodka tonic|gin tonic|bir dingin|paket minum|tuak|sloki|bir botol",
  "bar rooftop|pub|lounge|beer garden|club|kafe malam|resto bar|wine bar|beach club|Bintang Pub",
  40000, 800000, "beli,bayar,pesen,order")
R(P, "Kue & Bakery",
  "roti tawar|donat|brownies|kue ulang tahun|bolu|croissant|roti sobek|cheesecake|pastry|kue lapis|kue kering lebaran|risoles|pukis|cake slice|roti bakar|kue basah|kue cubit|roti manis|cupcake|tart|bolen|kue nastar|roti isi|bolu gulung|lapis legit|kue pesanan",
  "BreadTalk|Holland Bakery|Tous les Jours|Breadlife|Roti O|Dunkin|J.CO|toko roti langganan|Kartika Sari|Roti Gembong|Pastel Bakery|pasar kue",
  6000, 350000, "beli,bayar,pesen,order")
R(P, "Pizza & Western",
  "pizza large|pasta carbonara|steak sirloin|fish and chips|lasagna|spaghetti bolognese|garlic bread|burrito|nachos|burger premium|salad|beef burger|chicken steak|pizza pepperoni|risotto|calzone|wagyu steak|pizza medium|paket pizza|grilled chicken",
  "Pizza Hut|Domino's|Pizza Marzano|Papa Ron's|Sbarro|Hog's Breath|Abuba Steak|Steak 21|Holycow|Fiesta Steak|Carl's Jr|Pizza Maru|Waroeng Steak|resto Italia",
  35000, 500000, "beli,bayar,pesen,order,makan")
R(P, "Es Krim & Dessert",
  "es krim cone|gelato|sundae|es krim vanilla|puding|churros|waffle|pancake|mochi|dessert box|banana split|es doger|es puter|es teler|bingsu|macaron|croffle|pisang nugget|tiramisu|mille crepe|es krim cup|es krim tub",
  "Baskin Robbins|Haagen-Dazs|Walls|Ragusa|Aice|Gelato Secrets|Mixue|Hokkaido Baked Cheese|Dairy Queen|Cold Stone|Mamarica|Mochi Mochi|Indomaret|Alfamart",
  8000, 120000, "beli,bayar,jajan,pesen")

# ======================= TRANSPORTASI =======================
P = "Transportasi"
R(P, "Bahan Bakar & SPBU",
  "bensin|pertalite|pertamax|pertamax turbo|solar|dexlite|bensin motor|bensin mobil|BBM|bensin full tank|bensin 5 liter|bensin 3 liter|bensin 10 liter|bensin eceran|pertamax green|bensin seliter",
  "SPBU Pertamina|Shell|BP AKR|Vivo|SPBU depan|Pertamini|SPBU tol|Pertashop|SPBU deket rumah",
  10000, 700000, "isi,beli,bayar,tambah")
R(P, "Mobil Pribadi",
  "oli mobil|ban mobil|aki mobil|wiper mobil|kampas rem|oli motor|ban motor|aki motor|rantai motor|pajak tahunan mobil|pajak tahunan motor|perpanjang STNK|servis berkala mobil|servis motor|cuci mobil|cuci motor|spooring balancing|tune up mesin|tambal ban|asuransi kendaraan|lampu mobil|AC mobil|body repair|kaca film|aksesoris mobil|ganti oli|servis rutin|kampas rem motor|busi",
  "bengkel Astra|bengkel langganan|Auto2000|AHASS|bengkel resmi|Carwash|Shop&Drive|bengkel Pak Haji|tambal ban pinggir jalan|Mobil88|bengkel Yamaha|doorsmeer",
  20000, 4500000, "bayar,beli,bayarin")
R(P, "Bus & Angkot",
  "bus Transjakarta|angkot|bus kota|Damri|bus antar kota|TransJogja|Trans Semarang|Trans Metro Bandung|metromini|bus AKAP|bus ke Bandung|travel Jakarta Bandung|elf|ongkos angkot|bus sekolah|Suroboyo Bus|Teman Bus|bus Trans Koetaradja|bus malam|bus pariwisata",
  "Transjakarta|Damri|Primajasa|Sinar Jaya|Rosalia Indah|Lorena|Agra Mas|Pahala Kencana|travel langganan|terminal",
  3500, 300000, "naik,bayar,ongkos,beli tiket",
  "3500,3500,4000,5000,6000,7000,10000,15000,20000")
R(P, "Kereta & MRT / KRL",
  "KRL|Commuter Line|MRT|LRT|LRT Jabodebek|kereta bandara|top up kartu KRL|top up kartu MRT|kartu multi trip|tiket MRT pulang pergi|tiket KRL ke Bogor|tiket LRT Palembang|KRL ke Jakarta Kota|MRT ke Lebak Bulus|LRT ke Dukuh Atas|KRL pulang kantor",
  "KAI Commuter|MRT Jakarta|LRT Jakarta|stasiun|KMT|Bank Mandiri e-money|Flazz|BNI TapCash|Brizzi",
  3000, 150000, "naik,bayar,top up,isi",
  "3000,3000,4000,5000,7000,9000,14000,20000,50000,100000")
R(P, "Taksi & Ojek Online",
  "Gojek|Grab|Grab Car|GoCar|Maxim|inDrive|Blue Bird|taksi bandara|ojek pangkalan|ojek online ke kantor|GoRide|GrabBike|taksi online|ojol pulang|ojek ke stasiun|taksi argo|Bluebird ke bandara|GoCar ke mall|Grab ke bandara|ojol ke kampus|Grab pulang malam",
  "Gojek|Grab|Maxim|inDrive|Blue Bird|Gocar|Grab Car",
  8000, 350000, "naik,order,pesen,bayar")
R(P, "Tiket Pesawat",
  "tiket pesawat Jakarta Bali|tiket Garuda|tiket Lion Air|tiket Citilink|tiket AirAsia|tiket Batik Air|tiket pesawat mudik|tiket Super Air Jet|tiket pulang pergi Jakarta Surabaya|tiket ke Medan|tiket ke Makassar|tiket ke Singapore|tiket ke Kuala Lumpur|bagasi tambahan|tiket pesawat balik|tiket penerbangan|tiket ke Jogja|tiket ke Lombok|tiket ke Bangkok|tiket Jakarta Padang",
  "Traveloka|tiket.com|Agoda|Pegipegi|aplikasi maskapai|Traveloka|Citilink app|Garuda Indonesia",
  400000, 8000000, "beli,bayar,booking,pesen")
R(P, "Kereta Api Jarak Jauh",
  "tiket kereta Jakarta Surabaya|tiket Argo Bromo|tiket Taksaka|tiket Gajayana|tiket Whoosh|tiket kereta ke Jogja|tiket kereta mudik|tiket Argo Parahyangan|tiket Serayu|tiket kereta ke Bandung|kereta ekonomi|kereta eksekutif|tiket kereta Malang|tiket Lodaya|tiket Sembrani|tiket kereta Semarang|tiket Kertajaya|tiket Whoosh Halim Padalarang|tiket kereta Purwokerto",
  "KAI Access|Traveloka|tiket.com|loket stasiun|Access by KAI|Tiket.com",
  50000, 1500000, "beli,bayar,booking,pesen")
R(P, "Sepeda",
  "servis sepeda|ban dalam sepeda|rantai sepeda|helm sepeda|sepeda lipat|sepeda gunung|lampu sepeda|sadel|pompa sepeda|rem sepeda|sewa sepeda|aksesoris sepeda|gembok sepeda|sepatu cleat|sepeda listrik|baterai sepeda listrik|jersey sepeda|pedal sepeda|botol minum sepeda",
  "toko sepeda|bengkel sepeda|Polygon|United Bike|Decathlon|Tokopedia|Shopee|Element|Wim Cycle",
  15000, 12000000, "beli,bayar,sewa")
R(P, "Parkir & Tol",
  "parkir|parkir mall|tol|tol Jagorawi|tol Cipularang|top up e-toll|parkir inap|parkir motor|parkir bandara|parkir liar|tol Trans Jawa|tol Cikampek|tol dalam kota|parkir kantor|parkir stasiun|parkir bulanan|e-money buat tol|tol JORR|tiket parkir|tol Palikanci|jukir",
  "Jasa Marga|Mall parkir|Parkir bandara|Secure Parking|parkir kampus|gerbang tol|Bank Mandiri e-toll|BCA Flazz|BNI TapCash",
  2000, 250000, "bayar,beli,top up",
  "2000,3000,5000,5000,10000,15000,20000,50000,100000")

# ======================= BELANJA & BELANJAAN =======================
P = "Belanja & Belanjaan"
R(P, "Belanja Online",
  "case HP|charger|tas|sepatu|kaos|kabel data|earphone|lampu LED|tempat pensil|botol minum|jam dinding|keranjang|celana|hijab|headset|power bank|mousepad|sarung bantal|rak sepatu|sandal|paket checkout|ongkir|flash sale|barang COD|pesanan dari keranjang|belanja bulanan online|aksesoris HP|tripod mini|tote bag|gantungan kunci",
  "Shopee|Tokopedia|Lazada|TikTok Shop|Blibli|Bukalapak|Zalora|AliExpress|Shein|Temu",
  15000, 1500000, "beli,bayar,checkout,borong")
R(P, "Supermarket & Minimarket",
  "belanja bulanan|belanja mingguan|sembako|beras 5 kg|minyak goreng|telur sekilo|susu UHT|mie instan sedus|gula pasir|sabun mandi|shampo|detergen|snack|tisu|air mineral|roti dan selai|buah dan sayur|daging ayam|belanja dapur|camilan|kopi sachet|sereal|minuman dingin|jajan Indomaret|groceries|popok|pembalut|susu kotak|yogurt|keju",
  "Indomaret|Alfamart|Superindo|Hypermart|Carrefour|Lotte Mart|Transmart|Farmers Market|Ranch Market|Alfamidi|Lawson|FamilyMart|Circle K|Yogya|Hero|Naga Swalayan",
  5000, 1500000, "belanja,beli,bayar")
R(P, "Toko Kelontong",
  "beras|gula|minyak|telur|rokok|galon isi ulang|gas elpiji 3 kg|sabun cuci|kopi|teh|garam|bumbu dapur|sembako|mie instan|sayur|tahu tempe|bawang merah|cabai|galon Aqua|gas melon|kecap|saos|tepung terigu|susu kental manis|minyak sayur|air isi ulang",
  "warung Bu Ani|toko kelontong|warung depan|warung Pak Haji|toko sembako|warung sebelah|pasar|tukang sayur|abang sayur keliling|warung Madura|toko Madura",
  3000, 250000, "beli,bayar,ambil")
R(P, "Mall & Pusat Belanja",
  "belanja di mall|belanja akhir pekan|barang diskon|sale|food court|belanja di department store|jalan-jalan mall|window shopping|belanja gajian|midnight sale|belanja di Matahari|belanja di Sogo|belanja di Metro|shopping bareng|nongkrong di mall|belanja pakaian dan makan",
  "Pacific Place|PIM|Grand Indonesia|Kota Kasablanka|Senayan City|Central Park|Mal Kelapa Gading|Pondok Indah Mall|Summarecon Mall|Lippo Mall|Sarinah|Tunjungan Plaza|Paris Van Java|Trans Studio Mall|Mall Ciputra|Plaza Indonesia",
  50000, 3000000, "habis,bayar,belanja")
R(P, "Pakaian & Busana",
  "kemeja kerja|kaos|celana jeans|dress|hijab|gamis|jaket|sepatu sneakers|sandal|batik|baju koko|kebaya|rok|sweater|kaos kaki|pakaian dalam|seragam|blazer|hoodie|celana chino|jilbab pashmina|setelan jas|baju lebaran|sarung|mukena|baju olahraga|piyama|kemeja flanel|celana kulot|cardigan",
  "Uniqlo|H&M|Zara|Erigo|Matahari|Zalora|Cotton On|Mango|The Executive|Hijabenka|Batik Keris|Pasar Tanah Abang|thrift shop|Pasar Baru|distro|Bata|Nike|Adidas|Compass|Ventela",
  25000, 2500000, "beli,bayar,borong")
R(P, "Aksesoris & Jam Tangan",
  "jam tangan|smartwatch|strap jam|baterai jam tangan|kacamata hitam|ikat pinggang|dompet|topi|syal|gantungan kunci|jepit rambut|bros|dompet kulit|tas selempang|gelang karet|kacamata fashion|bandana|dasi|scrunchie",
  "Casio|Fossil|Alexandre Christie|Daniel Wellington|Tokopedia|Shopee|Optik Melawai|toko jam|Miniso|Pedro|Charles & Keith",
  15000, 8000000, "beli,bayar,ganti")
R(P, "Perhiasan",
  "cincin emas|kalung emas|gelang emas|anting emas|liontin|cincin berlian|mata kalung|cincin tunangan|perhiasan perak|cincin couple|kalung mutiara|giwang|emas 22 karat|gelang kaki|cincin kawin|kalung perak|gelang tangan emas|set perhiasan",
  "toko emas langganan|Toko Emas Pak Haji|Frank & Co|Tiara|Lotus|Pandora|Mondial|Hartadinata|Semar Nusantara|toko mas",
  150000, 60000000, "beli,bayar")

# ======================= HIBURAN & REKREASI =======================
P = "Hiburan & Rekreasi"
R(P, "Film & Bioskop",
  "tiket bioskop|tiket film|tiket nobar|popcorn combo|tiket premiere|tiket IMAX|tiket 4DX|tiket Gold Class|tiket film horor|langganan Netflix|langganan Disney+|langganan Vidio|langganan Prime Video|langganan WeTV|langganan Viu|sewa film|popcorn dan minum|tiket film Indonesia|tiket nonton bareng",
  "CGV|XXI|Cinepolis|Flix Cinema|tix.id|Netflix|Vidio|Disney+ Hotstar|Prime Video|Bioskop Online",
  20000, 300000, "beli,bayar,booking,pesen")
R(P, "Musik & Konser",
  "tiket konser|tiket festival musik|langganan Spotify|YouTube Premium|Apple Music|JOOX|tiket pensi|merch konser|lightstick|tiket fan meeting|tiket konser jazz|tiket konser K-pop|tiket war konser|album fisik|vinyl|tiket konser dangdut|tiket musik akustik|tiket Synchronize|tiket Java Jazz|tiket We The Fest",
  "tiket.com|Loket|Blibli Tiket|Spotify|GoTix|Ticketbox|Tokopedia|official merch|Shopee",
  25000, 5000000, "beli,bayar,war,booking")
R(P, "Game & Voucher",
  "diamond Mobile Legends|UC PUBG|voucher Google Play|voucher Steam|diamond Free Fire|Genshin Impact|Valorant Points|skin game|battle pass|game Steam|PlayStation Plus|Xbox Game Pass|voucher Roblox|Honor of Kings|voucher Garena|game Nintendo|gift card|in-app purchase|chip domino|Higgs Domino|Robux|voucher PSN|weekly diamond pass|starlight member",
  "Codashop|UniPin|Steam|Google Play|App Store|Playstation Store|Garena|Itemku|Tokopedia|VCGamers|Lapakgaming|Shopee",
  10000, 1500000, "top up,beli,bayar,isi")
R(P, "Sepak Bola & Olahraga",
  "tiket pertandingan sepak bola|tiket Persija|tiket Persib|tiket Timnas|jersey bola|sepatu bola|sewa lapangan futsal|futsal bareng|iuran futsal|sewa lapangan badminton|main badminton|tiket Liga 1|bola futsal|jersey Timnas|sewa lapangan basket|raket badminton|shuttlecock|tiket MotoGP|tiket marathon|pendaftaran lari|biaya fun run|tiket renang|sewa lapangan tenis|iuran mabar basket|sewa lapangan mini soccer",
  "Decathlon|GOR|lapangan futsal|Mitra Sport|Tokopedia|Shopee|Specs|Mills|Ortuseight|tiket.com|Loket",
  10000, 3500000, "bayar,beli,iuran")
R(P, "Liburan & Wisata",
  "tiket masuk wisata|hotel|penginapan|villa|homestay|tiket Dufan|tiket Taman Safari|tiket Ancol|tiket Candi Borobudur|tiket kebun binatang|tiket Trans Studio|sewa motor di Bali|paket tour|snorkeling|diving|tiket Jatim Park|tiket pantai|oleh-oleh|booking hotel|Airbnb|camping|sewa tenda|tiket kawah putih|tiket Waterbom|tiket kapal feri|paket open trip|tiket masuk museum|sewa mobil liburan|penginapan semalam|tiket Labuan Bajo",
  "Traveloka|Agoda|Booking.com|Airbnb|tiket.com|Pegipegi|RedDoorz|OYO|Klook|Traveloka Xperience",
  25000, 8000000, "bayar,beli,booking,pesen")
R(P, "Fotografi",
  "sewa kamera|lensa kamera|sewa lensa|cetak foto|foto studio|foto wisuda|jasa fotografer|foto prewedding|memory card|baterai kamera|tripod|album foto|photobox|self photo studio|ring light|langganan Adobe Lightroom|drone|filter lensa|tas kamera|kamera mirrorless|film roll|foto keluarga|jasa foto produk|cuci cetak film",
  "studio foto|Photobox|Kamerakita|fotografer langganan|Tokopedia|Shopee|Fotoyu|Jagonya Kamera|Kamera Jaya|self photo studio",
  10000, 25000000, "bayar,beli,sewa")
R(P, "Seni & Hobi",
  "cat air|kuas lukis|kanvas|pensil warna|sketchbook|alat gambar|benang rajut|jarum jahit|tanaman hias|pot tanaman|puzzle|lego|action figure|model kit|gitar|senar gitar|ukulele|kain perca|sticker journaling|washi tape|bahan resin|gundam|board game|kartu TCG|aglonema|bibit tanaman|alat pancing|umpan pancing|clay|diecast|hot wheels",
  "Gramedia|toko seni|Tokopedia|Shopee|toko hobi|Hobby Shop|Mitra Hobby|Kenko|Art Shop|toko tanaman",
  5000, 15000000, "beli,bayar,borong")

# ======================= KEBUTUHAN RUMAH =======================
P = "Kebutuhan Rumah"
R(P, "Perabot & Rumah Tangga",
  "kasur|lemari|meja makan|kursi|rak buku|sofa|bantal guling|sprei|gorden|karpet|lampu hias|piring dan gelas|panci|wajan|rice cooker|kompor gas|dispenser|setrika|kipas angin|matras|meja belajar|kasur lipat|rak sepatu|organizer|cermin|jam dinding|selimut|handuk|ember|gantungan baju|tempat sampah|alat makan|toples|termos",
  "IKEA|Informa|ACE Hardware|Ruparupa|Fabelio|Olympic|Lazada|Tokopedia|Shopee|Mitra10|Index Living Mall|Mr. DIY|Miniso",
  15000, 15000000, "beli,bayar,borong")
R(P, "Laundry & Cuci Baju",
  "laundry kiloan|cuci setrika|laundry baju|laundry selimut|dry cleaning jas|cuci sepatu|laundry karpet|cuci bed cover|laundry express|laundry bulanan|cuci kering|laundry sprei|setrika saja|laundry coin|cuci gorden|cuci boneka|cuci jaket",
  "laundry langganan|laundry kampus|laundry depan kos|laundry Bu Dewi|Cuci Express|Laundry Coin|Fresh Laundry|laundry deket rumah",
  10000, 300000, "bayar,bayarin,tebus")
R(P, "Kebersihan & Alat Cuci",
  "sabun cuci piring|detergen|pewangi pakaian|pembersih lantai|sapu|pel|sikat WC|cairan pembersih kaca|tisu|sabun cuci tangan|kantong sampah|spons cuci|karbol|pengharum ruangan|softener|obat nyamuk|disinfektan|lap microfiber|sabun colek|refill sabun|sikat baju|ember dan gayung|cairan pembersih toilet|baygon",
  "Indomaret|Alfamart|Shopee|Hypermart|Tokopedia|Superindo|warung|Transmart",
  3000, 150000, "beli,bayar,beliin")
R(P, "Perbaikan & Tukang",
  "tukang bangunan|tukang ledeng|servis AC|tukang listrik|cat tembok|ganti genteng|perbaikan atap|tambal bocor|servis kulkas|servis mesin cuci|renovasi dapur|pasang keramik|tukang las|ganti pipa|kunci pintu|pasang CCTV|servis pompa air|ongkos tukang|upah tukang|semen dan pasir|cat|paku dan baut|tukang kunci|pasang kanopi|pasang wallpaper|tukang taman|kuras toren|sedot WC|servis kompor|pasang AC baru",
  "Mitra10|ACE|Depo Bangunan|toko bangunan|tukang Pak Slamet|Urban Company|Kang Servis|Tokopedia|Shopee|home service",
  25000, 25000000, "bayar,beli,bayarin")
R(P, "Listrik & Elektronik",
  "lampu LED|kabel roll|stop kontak|saklar|baterai AA|charger|kabel HDMI|speaker bluetooth|TV|kulkas|mesin cuci|blender|air fryer|microwave|vacuum cleaner|kipas|setrika uap|stabilizer|smart plug|bohlam|colokan T|power bank|headphone|remote TV|televisi 32 inch|hair dryer|kamera CCTV|speaker aktif|mixer|oven listrik",
  "Electronic City|ACE|Tokopedia|Shopee|Lazada|Hartono Elektronik|Blibli|Best Denki|Courts|Mitra10|Samsung Store|Mi Store|Philips",
  10000, 15000000, "beli,bayar,cicil")
R(P, "Hewan Peliharaan",
  "makanan kucing|pasir kucing|dry food anjing|vaksin kucing|vaksin anjing|grooming kucing|steril kucing|vitamin hewan|kandang|kalung hewan|mainan kucing|dokter hewan|check up kucing|obat kutu|pakan ikan hias|pakan burung|titip kucing|pet hotel|Royal Canin|Whiskas|Me-O|pasir bentonite|litter box|snack anjing|scaling gigi kucing|rawat inap kucing|wet food kucing",
  "petshop|Pet Kingdom|Pet Lovers Centre|klinik hewan|Tokopedia|Shopee|drh langganan|Pet Station|toko hewan",
  10000, 5000000, "beli,bayar,beliin")
R(P, "Kebutuhan Bayi & Anak",
  "popok|susu formula|bubur bayi|MPASI|baju bayi|stroller|botol susu|tisu basah|minyak telon|bedak bayi|mainan anak|pampers|susu anak|vitamin anak|diapers|mainan edukasi|seragam anak|tas sekolah anak|sepatu anak|baby sitter|daycare|penitipan anak|buku cerita anak|gendongan bayi|car seat|kasur bayi|botol dot|pompa ASI|kantong ASI",
  "Babyshop|Mothercare|Indomaret|Alfamart|Shopee|Tokopedia|Blibli|toko perlengkapan bayi|Kidz Station|Toys Kingdom|Mamypoko",
  10000, 8000000, "beli,bayar,beliin")

# ======================= KESEHATAN & MEDIS =======================
P = "Kesehatan & Medis"
R(P, "Rumah Sakit & Rawat",
  "rawat inap|biaya operasi|UGD|rawat jalan|MRI|CT scan|rontgen|opname|persalinan|biaya melahirkan|cuci darah|tindakan medis|biaya kamar|rawat inap anak|operasi usus buntu|operasi caesar|biaya IGD|tagihan rumah sakit|biaya ICU|USG di RS|biaya rawat inap ayah",
  "RS Siloam|RS Mitra Keluarga|RSUD|RS Pondok Indah|RS Hermina|RS Premier|RS Pertamina|RS Bunda|RS Santosa|RS Medistra",
  150000, 150000000, "bayar,lunasi,tebus")
R(P, "Klinik & Dokter",
  "konsultasi dokter|dokter umum|dokter gigi|scaling gigi|tambal gigi|cabut gigi|dokter spesialis anak|dokter kandungan|dokter kulit|dokter mata|cek lab|cek darah|cek kolesterol|vaksin flu|imunisasi anak|fisioterapi|telemedicine|periksa mata|general check up|medical check up|rapid test|PCR|surat keterangan sehat|USG|cek gula darah|konsul dokter THT|behel|bleaching gigi",
  "klinik pratama|Halodoc|Alodokter|Prodia|Kimia Farma Klinik|klinik dokter gigi|Puskesmas|Siloam Clinic|lab Pramita|Optik Tunggal",
  25000, 5000000, "bayar,bayarin,tebus")
R(P, "Obat & Apotek",
  "obat flu|paracetamol|vitamin C|obat batuk|obat maag|antibiotik|obat sakit kepala|plester|betadine|masker medis|suplemen|obat tetes mata|obat alergi|vitamin D|obat diare|salep|minyak kayu putih|tolak angin|obat resep dokter|obat darah tinggi|insulin|obat asma|oralit|vitamin B kompleks|multivitamin|hand sanitizer|termometer|tensimeter|obat pereda nyeri|antasida|probiotik",
  "Kimia Farma|Guardian|K24|Apotek Century|Apotek Roxy|apotek 24 jam|Halodoc|Good Doctor|apotek deket rumah|Apotek Sehat",
  3000, 1500000, "beli,bayar,tebus")
R(P, "Gym & Fitness",
  "membership gym|langganan gym|personal trainer|kelas yoga|kelas pilates|daily pass gym|kelas zumba|member Celebrity Fitness|member Fitness First|kelas Muay Thai|paket PT|kelas Crossfit|protein whey|creatine|botol shaker|matras yoga|dumbbell|resistance band|sepatu lari|baju gym|sarung tangan gym|kelas boxing|iuran gym|perpanjang membership",
  "Celebrity Fitness|Fitness First|Gold's Gym|Anytime Fitness|Chalow Gym|studio pilates|yoga studio|Decathlon|Tokopedia|Shopee|gym kampus",
  20000, 12000000, "bayar,beli,perpanjang")
R(P, "Salon & Spa",
  "creambath|facial|massage|pijat refleksi|spa|totok wajah|hair spa|lulur|body scrub|manicure pedicure|nail art|eyelash extension|smoothing|hair coloring|rebonding|keratin treatment|waxing|sulam alis|pijat tradisional|pijat urut|sauna|body massage|aromaterapi|pedicure|makeup artist|rias pengantin|tata rias wisuda",
  "Rudy Hadisuwarno|Johnny Andrean|London Beauty|Martha Tilaar|Bali Spa|Heavenly Spa|salon muslimah|salon Tante Ani|Mustika Ratu|nail studio|pijat panggilan|mas pijat",
  25000, 3500000, "bayar,beli,booking")
R(P, "Konseling & Mental",
  "sesi konseling|psikolog|psikiater|terapi|konsultasi psikolog|tes psikologi|sesi terapi online|terapi CBT|konseling pernikahan|konseling keluarga|langganan Calm|Headspace|tes kepribadian|assessment ADHD|konseling karir|terapi trauma|psikoterapi|biaya psikiater|obat dari psikiater|sesi coaching mental",
  "Riliv|Satu Persen|klinik psikologi|psikolog klinis|Alodokter|Halodoc|Ibunda.id|Mind Space|Calm|Headspace",
  50000, 2000000, "bayar,bayarin,booking")
R(P, "Skincare & Perawatan",
  "serum|sunscreen|moisturizer|facial wash|toner|masker wajah|lip balm|sabun muka|body lotion|bedak|parfum|deodoran|hair mask|shampo anti ketombe|lipstik|cushion|maskara|pensil alis|micellar water|krim malam|essence|serum vitamin C|sheet mask|krim wajah dokter|retinol|eyeliner|foundation|setting spray|parfum refill|pembersih make up",
  "Sociolla|Watsons|Guardian|Shopee|Tokopedia|Sephora|Beauty Haul|Looke|Wardah|Somethinc|Scarlett|Skintific|Azarine|Emina",
  10000, 1500000, "beli,bayar,borong")
R(P, "Potong Rambut",
  "potong rambut|cukur rambut|barbershop|cukur jenggot|potong rambut anak|cukur kumis|cukuran|potong rambut plus keramas|haircut|trim rambut|rapihin rambut|pangkas rambut|semir rambut|gunting rambut|potong poni|undercut|tipping barber",
  "barbershop|pangkas rambut Madura|barber langganan|Gentleman Barbershop|pangkas rambut Pak De|salon|mas barber|barbershop kampus|cukur Madura",
  10000, 200000, "bayar,bayarin,kasih")

# ======================= PENDIDIKAN & KARIR =======================
P = "Pendidikan & Karir"
R(P, "Sekolah & Kuliah",
  "SPP|uang pangkal|UKT|uang gedung|biaya semester|iuran sekolah|uang seragam|les privat|bimbel|uang ujian|biaya wisuda|SPP anak|uang kegiatan sekolah|uang study tour|uang buku sekolah|daftar ulang|biaya skripsi|biaya sidang|uang komite|biaya pendaftaran kuliah|biaya ujian masuk|biaya TOEFL|biaya praktikum|iuran kelas|biaya ekskul|uang les anak|bimbel UTBK|uang jaket almamater",
  "Ganesha Operation|Primagama|Ruangguru|Zenius|Quipper|sekolah|kampus|yayasan|Brain Academy|universitas|SMA|SMP|bendahara kelas",
  50000, 50000000, "bayar,lunasi,transfer,cicil")
R(P, "Buku & Referensi",
  "buku novel|buku pelajaran|buku kuliah|kamus|modul belajar|buku bekas|jurnal berbayar|e-book|buku resep|komik|majalah|fotokopi buku|buku latihan soal|buku TOEFL|langganan Gramedia Digital|buku cetak|buku agama|buku anak|manga|diktat|buku bacaan|buku motivasi|buku keuangan|buku skripsi",
  "Gramedia|Periplus|Togamas|Shopee|Tokopedia|Kinokuniya|Gramedia Digital|Google Play Books|Gunung Agung|toko buku bekas|Palasari|Kwitang|Gramedia Online",
  5000, 800000, "beli,bayar,borong")
R(P, "Komputer & Perangkat",
  "laptop|mouse|keyboard|monitor|flashdisk|hardisk eksternal|SSD|RAM|printer|tinta printer|webcam|headset kerja|hub USB|kabel LAN|servis laptop|ganti baterai laptop|charger laptop|tablet|iPad|HP baru|upgrade RAM|Windows original|Microsoft 365|antivirus|lisensi software|domain website|hosting|VPS|langganan ChatGPT|cloud storage|iCloud|Google One|servis HP|ganti layar HP|casing laptop|cooling pad|mousepad|stand laptop|PC rakitan|power supply",
  "Tokopedia|Shopee|Bhinneka|iBox|Erafone|Pasar Glodok|Mangga Dua|ITC|Jakmall|Blibli|Lazada|Enter Komputer|Samsung Store|Apple Store|Dinomarket",
  20000, 30000000, "beli,bayar,cicil")
R(P, "Pulsa & Paket Data",
  "pulsa|paket data|kuota internet|pulsa Telkomsel|pulsa XL|pulsa Indosat|pulsa Tri|pulsa Smartfren|paket data 30GB|kuota harian|kuota belajar|paket combo|isi ulang kartu|perpanjang kuota|paket data bulanan|paket roaming|kuota unlimited|kuota|pulsa by.U|pulsa AXIS|data bulanan",
  "Telkomsel|XL|Indosat|Tri|Smartfren|by.U|AXIS|Tokopedia|Shopee|myTelkomsel|myXL|Bukalapak|DANA|GoPay|OVO|Alfamart|Indomaret",
  5000, 400000, "isi,beli,top up,bayar",
  "5000,10000,15000,20000,25000,30000,50000,100000,150000,200000")
R(P, "Kursus Bahasa & Skill",
  "kursus bahasa Inggris|les IELTS|kursus bahasa Jepang|kursus bahasa Korea|kelas Mandarin|kursus bahasa Jerman|kursus coding|bootcamp|kelas desain grafis|kursus online Udemy|Coursera|kursus Excel|kelas public speaking|kursus menyetir|kursus masak|kursus barista|kursus fotografi|kursus renang|ujian sertifikasi|kursus akuntansi|kursus pajak|kelas digital marketing|Skill Academy|kursus musik|les piano|les gitar|les vokal|kelas menjahit|kursus make up|workshop|webinar berbayar|kelas data analyst|Duolingo Plus|kelas UI/UX",
  "EF|ELTI|Wall Street English|LB LIA|Udemy|Coursera|Skill Academy Ruangguru|Hacktiv8|Purwadhika|Dicoding|Skillshare|Binar Academy|Kampung Inggris Pare|Duolingo",
  50000, 15000000, "bayar,daftar,beli,cicil")
R(P, "Alat Kantor & Riset",
  "kertas A4|pulpen|buku catatan|map|stabilo|tinta|toner|stapler|binder|printing laporan|jilid skripsi|cetak poster|fotokopi|kertas HVS|amplop|spidol|papan tulis|jasa cetak|bayar jurnal riset|honor responden|bahan praktikum|kuesioner|penerjemahan|proofreading|cek plagiasi|Turnitin|lisensi SPSS|Grammarly|laminating|ATK|ID card|kartu nama|stempel|banner",
  "Gramedia|fotokopi dekat kampus|printing|toko ATK|Tokopedia|Shopee|Joyko|Faber-Castell|Office Mart|ATK murah|percetakan|fotocopy centre|Kenko",
  2000, 3000000, "beli,bayar,cetak")

# ======================= TAGIHAN & FINANSIAL =======================
P = "Tagihan & Finansial"
R(P, "Tagihan Listrik & Air",
  "token listrik|tagihan PLN|listrik pascabayar|listrik prabayar|tagihan PDAM|air PAM|listrik bulan ini|air bulan ini|listrik dan air|iuran air|listrik rumah|listrik kontrakan|listrik kos|tagihan PAM Jaya|token PLN|tagihan listrik",
  "PLN Mobile|Tokopedia|Alfamart|Indomaret|Livin|myBCA|GoPay|DANA|OVO|Shopee|Bukalapak|kantor pos|PDAM|PLN",
  20000, 2500000, "bayar,beli,isi,top up",
  "20000,50000,100000,100000,150000,200000,300000,500000")
R(P, "Internet & Wifi",
  "wifi bulanan|IndiHome|Biznet|MyRepublic|First Media|tagihan internet|CBN|paket wifi|iForte|wifi kos|iuran wifi|tagihan IndiHome|internet rumah|upgrade paket wifi|wifi RT RW net|biaya pasang baru|modem wifi|router baru|extender wifi|tagihan fiber|Starlink|Telkomsel Orbit|biaya aktivasi wifi",
  "IndiHome|Biznet|MyRepublic|First Media|CBN|MNC Play|myIndiHome|Tokopedia|Shopee|PLN Icon Plus|Telkomsel Orbit|XL Home",
  100000, 1500000, "bayar,perpanjang,beli",
  "100000,150000,200000,250000,300000,350000,450000")
R(P, "Donasi & Zakat",
  "zakat fitrah|zakat mal|zakat penghasilan|infaq|sedekah|donasi bencana|donasi Kitabisa|kotak amal masjid|sumbangan panti asuhan|wakaf|sedekah Jumat|qurban kambing|patungan kurban|iuran masjid|donasi banjir|donasi gempa|sumbangan warga|amal jariyah|infak subuh|santunan anak yatim|donasi kemanusiaan|kolekte gereja|persembahan gereja|dana punia|sumbangan duka|iuran takziah",
  "Kitabisa|BAZNAS|Dompet Dhuafa|Rumah Zakat|LAZ|masjid|gereja|Lazismu|NU Care|Baitulmaal Muamalat",
  2000, 20000000, "bayar,kasih,sumbang,transfer")
R(P, "Biaya Administrasi Bank",
  "biaya admin bulanan|biaya admin transfer|biaya admin ATM|biaya kartu debit|iuran tahunan kartu kredit|biaya tarik tunai|biaya SMS banking|biaya materai|biaya transfer antar bank|biaya BI-Fast|biaya RTGS|biaya top up e-wallet|biaya potongan rekening|biaya cetak buku tabungan|biaya penutupan rekening|biaya ganti kartu ATM|denda keterlambatan kartu kredit|bunga kartu kredit|biaya layanan|biaya provisi|biaya admin e-wallet|biaya tarik tunai beda bank|biaya setor tunai|biaya admin kartu",
  "BCA|Mandiri|BRI|BNI|CIMB Niaga|Jenius|SeaBank|Bank Jago|Permata|DANA|OVO|BTN|Danamon|Maybank|Livin|BSI",
  500, 500000, "kena,bayar,dipotong",
  "2500,2500,6500,7500,12500,15000,30000,35000,50000")
R(P, "Pengeluaran Lainnya",
  "keperluan mendadak|biaya tak terduga|lain-lain|iuran RT|iuran keamanan|uang kebersihan|denda tilang|biaya fotokopi KTP|biaya perpanjang SIM|bikin KTP|biaya notaris|materai|ganti kunci rumah|hadiah ulang tahun teman|amplop kondangan|sumbangan nikahan|kado pernikahan|angpao keponakan|uang arisan|iuran arisan|traktiran|patungan kantor|bayar utang|cicilan teman|ongkos kirim|ekspedisi JNE|biaya legalisir|uang sampah|salah transfer|denda perpustakaan|biaya pas foto|ganti rugi|nitip uang|pinjemin temen|kasih uang ke ibu|uang saku adik|uang tip",
  "",
  5000, 5000000, "bayar,kasih,beli,transfer")

# ======================= INCOME: GAJI & PENGHASILAN KERJA =======================
P = "Gaji & Penghasilan Kerja"
PAYERS = "kantor|PT Maju Jaya|perusahaan|instansi|dinas|sekolah|rumah sakit|toko|pabrik|startup|HRD|yayasan|PT Sinar Abadi|CV Mitra"
R(P, "Gaji Pokok Bulanan",
  "gaji bulanan|gaji pokok|gaji bulan ini|gaji bulan Oktober|gaji pertama|gaji karyawan|upah bulanan|payroll|gaji dari kantor|gaji PNS|gaji guru|gaji honorer|take home pay|gaji tetap|gaji awal bulan|gaji magang|uang saku magang|gaji harian|upah mingguan|gaji dokter|gaji perawat|gaji driver|gaji sales",
  PAYERS, 1500000, 35000000, "")
R(P, "Bonus Kerja & THR",
  "THR|THR Lebaran|bonus tahunan|bonus akhir tahun|bonus kinerja|bonus proyek|bonus target|gaji ke-13|gaji ke-14|tunjangan hari raya|bonus semester|bonus project selesai|bonus referral kerja|bonus karyawan|THR Natal|bonus kontrak|apresiasi kantor|bonus retensi|bonus jabatan|pesangon|uang pesangon",
  PAYERS, 500000, 60000000, "")
R(P, "Insentif & Komisi",
  "komisi penjualan|insentif sales|komisi affiliate|komisi reseller|insentif target|bonus per unit|fee referral|komisi closing|insentif driver|insentif ojol|bonus ojol|komisi dropship|komisi agen asuransi|komisi properti|insentif kinerja|komisi MLM|insentif harian|komisi iklan|insentif mitra|komisi TikTok affiliate|komisi Shopee affiliate|incentive weekly",
  "Shopee Affiliate|TikTok Affiliate|Gojek|Grab|Tokopedia|perusahaan|principal|agen|leader|kantor pusat",
  50000, 30000000, "")
R(P, "Uang Lembur",
  "uang lembur|lembur akhir pekan|lembur hari libur|lembur malam|upah lembur|lembur proyek|lembur bulan ini|lembur shift malam|lembur tanggal merah|uang makan lembur|lembur semalam|lembur 3 jam|lembur Sabtu|lembur Minggu|lembur deadline|lembur tambahan|lembur produksi|lembur go-live",
  "kantor|pabrik|perusahaan|HRD|payroll|PT Sinar Abadi", 50000, 5000000, "")
R(P, "Hasil Bisnis & Dagang",
  "hasil jualan|keuntungan usaha|omzet hari ini|untung dagang|penjualan warung|hasil dagang|profit bulan ini|penjualan online|hasil jualan nasi uduk|penjualan toko|pendapatan kedai kopi|hasil panen|hasil ternak|penjualan kue pesanan|hasil laundry|hasil jual pulsa|keuntungan dropship|hasil reseller|jualan baju online|pemasukan warung|hasil jual gorengan|setoran harian|hasil katering|penjualan bazar|laba usaha|hasil bengkel|hasil servis|pendapatan toko online|hasil jual sayur",
  "pelanggan|pembeli|Shopee|Tokopedia|reseller|customer|toko|marketplace|pasar|warung|bazar|pelanggan setia",
  20000, 50000000, "")
R(P, "Jasa Teknik & IT",
  "bayaran proyek website|fee developer|jasa pembuatan aplikasi|jasa instalasi jaringan|pembayaran proyek IT|jasa servis komputer|jasa install ulang laptop|konsultasi IT|fee freelance developer|pembuatan landing page|jasa maintenance server|fee bug fixing|jasa pasang CCTV|jasa servis AC|jasa teknisi|jasa kelistrikan|jasa las|jasa pembuatan bot|jasa install software|jasa scraping|jasa pembuatan website toko|pembayaran milestone|jasa konsultasi teknik|jasa perbaikan HP|fee mentor coding|jasa setup jaringan|retainer klien IT",
  "klien|client|PT Digital Nusantara|agency|startup|Upwork|Fiverr|Sribulancer|Projects.co.id|klien luar negeri|kantor klien|CV Karya",
  100000, 50000000, "")
R(P, "Jasa Desain & Kreatif",
  "fee desain logo|jasa desain grafis|jasa ilustrasi|jasa edit video|fee desain feed Instagram|jasa desain UI/UX|jasa desain kemasan|fee ilustrator|jasa video editing|jasa animasi|jasa copywriting|fee konten kreator|jasa foto produk|jasa desain undangan|fee endorse|jasa voice over|jasa penulisan artikel|jasa desain poster|jasa desain banner|jasa membuat thumbnail|fee desain brosur|fee desain presentasi|honor desain|fee brand identity|jasa ngedit reels|honor fotografer|fee desain sampul buku",
  "klien|client|agency|Fiverr|99designs|Sribulancer|brand|UMKM klien|PT Kreatif Media|studio|Upwork|Projects.co.id",
  50000, 30000000, "")

# ======================= INCOME: INVESTASI & FINANSIAL =======================
P = "Investasi & Finansial"
R(P, "Keuntungan Saham & Reksa Dana",
  "cuan saham|profit saham|realisasi profit saham|jual saham untung|profit reksa dana|keuntungan reksadana|capital gain|profit trading|cuan crypto|take profit|cuan Bibit|cuan Ajaib|redeem reksa dana|redeem obligasi|jual emas untung|profit emas Pluang|jual Bitcoin untung|profit day trading|profit swing trade|penarikan dana saham|withdraw RDN",
  "Ajaib|Bibit|Bareksa|Stockbit|IPOT|Pluang|Tokocrypto|Indodax|Pintu|Mirae Asset|RDN BCA|Gotrade|Mandiri Sekuritas|Binance",
  50000, 100000000, "")
R(P, "Bunga Tabungan & Deposito",
  "bunga tabungan|bunga deposito|bunga bank|bunga rekening|bunga deposito jatuh tempo|bunga Jago Pocket|bunga SeaBank|bunga Jenius|bunga tabungan berjangka|bunga giro|bunga obligasi|kupon SBN|kupon ORI|kupon sukuk|bunga tabungan bulan ini|bunga flexi|bunga deposito bulanan|bunga dana darurat|bunga rekening dana nasabah|bunga bulan lalu",
  "BCA|Mandiri|BRI|BNI|SeaBank|Bank Jago|Jenius|Blu by BCA|Allo Bank|Neo Commerce|CIMB Niaga|Permata|BTN",
  1000, 25000000, "")
R(P, "Dividen & Bagi Hasil",
  "dividen saham|dividen BBCA|dividen BBRI|dividen TLKM|dividen tahunan|dividen interim|bagi hasil usaha|bagi hasil sukuk|bagi hasil investasi|bagi hasil kebun|bagi hasil ternak|bagi hasil sawah|bagi hasil patungan|bagi hasil reksa dana syariah|bagi hasil deposito syariah|bagi hasil kemitraan|bagi hasil proyek|bagi hasil crowdfunding|bagi hasil P2P lending|bagi hasil koperasi|SHU koperasi|SHU tahunan|bagi hasil modal usaha|bagi hasil toko|bagi hasil dari partner",
  "RDN|KSEI|koperasi|bank syariah|BSI|Bareksa|Bibit|partner usaha|mitra|Amartha|Bank Muamalat",
  20000, 50000000, "")
R(P, "Sewa Kos / Properti",
  "uang sewa kos|sewa kos bulan ini|uang kontrakan|sewa rumah|sewa kamar|sewa ruko|sewa apartemen|sewa kios|sewa lahan|sewa tanah|uang sewa tahunan|sewa kos-kosan|sewa villa|sewa gudang|sewa lapak|pembayaran sewa rumah|sewa bulanan|setoran penghuni kos|sewa petak|sewa unit apartemen|sewa studio|sewa homestay|uang sewa rumah dari penyewa",
  "penyewa|anak kos|penghuni|tenant|Pak Budi|Bu Ratna|Airbnb|Mamikos|Rukita|Traveloka|mahasiswa|keluarga penyewa",
  300000, 100000000, "")
R(P, "Selisih Kurs Valas",
  "selisih kurs|untung kurs|profit valas|cuan USD|cuan dolar|jual dolar untung|jual valas untung|keuntungan tukar mata uang|profit forex|hasil trading forex|jual SGD untung|cuan euro|tukar dolar untung|selisih kurs dolar|gain kurs|cuan yen|selisih tukar rupiah|profit trading EUR/USD|profit XAU/USD|selisih kurs pembayaran|selisih kurs PayPal|selisih kurs Wise|take profit forex|profit scalping|cuan trading valas|cuan konversi USD ke rupiah",
  "Wise|PayPal|Payoneer|money changer|Exness|XM|Binance|IC Markets|BCA|CIMB|Bank Mandiri|Jenius",
  20000, 30000000, "")
R(P, "Cashback & Reward Kartu",
  "cashback kartu kredit|cashback GoPay|cashback OVO|cashback ShopeePay|cashback DANA|reward point|poin kartu kredit ditukar|cashback belanja|cashback LinkAja|cashback dari bank|cashback debit|cashback promo|cashback Shopee|cashback Tokopedia|cashback tiket|cashback kartu|miles ditukar|cashback BCA|cashback Jenius|cashback aplikasi|cashback tagihan|cashback pembelian pulsa|cashback e-wallet|rebate kartu|reward tahunan kartu|poin dikonversi uang|cashback Livin|cashback BRImo|cashback bulanan",
  "BCA|Mandiri|BRI|BNI|CIMB Niaga|Jenius|GoPay|OVO|DANA|ShopeePay|LinkAja|Livin|BRImo|Tokopedia|Shopee|Traveloka|myBCA",
  1000, 1500000, "",
  "1000,2000,5000,10000,15000,20000,25000,50000,75000,100000")

# ======================= INCOME: HADIAH & REZEKI =======================
P = "Hadiah & Rezeki"
R(P, "Angpao & Hadiah Tunai",
  "angpao Lebaran|angpao Imlek|angpao ulang tahun|uang saku dari orang tua|uang jajan dari ortu|THR dari om tante|salam tempel|amplop dari mertua|uang dari kakek|uang dari nenek|angpao nikahan|hadiah uang tunai|uang kaget|uang tanda terima kasih|transferan dari ibu|kiriman dari ayah|kiriman ortu|uang bulanan dari orang tua|uang dari saudara|uang hadiah ulang tahun|uang syukuran|angpao Natal|uang hadiah wisuda|uang saku dari kakak|uang lebaran|angpao digital|THR digital",
  "Ibu|Ayah|Bapak|Mama|Papa|Om|Tante|Kakek|Nenek|Kakak|Mertua|Paman|Bude|Pakde",
  20000, 10000000, "")
R(P, "Kado & Hadiah Acara",
  "hadiah doorprize|hadiah undian|hadiah dari kantor|hadiah gathering|kado dalam bentuk uang|kado pernikahan berupa uang|kado wisuda dari om|hadiah ulang tahun dari teman|hadiah lomba 17 Agustus|hadiah giveaway|hadiah dari sponsor|hadiah arisan|uang kado nikahan|hadiah dari klien|kado dari pacar berupa transfer|hadiah anniversary dari suami|hadiah dari pelanggan|hadiah ulang tahun dari kantor",
  "teman|kantor|panitia|sponsor|klien|keluarga|pacar|suami|istri|sahabat|rekan kerja",
  20000, 15000000, "")
R(P, "Penghargaan & Juara",
  "juara 1 lomba|hadiah juara|beasiswa|uang pembinaan|hadiah lomba desain|juara lomba karya tulis|prize money|hadiah olimpiade|hadiah hackathon|hadiah kompetisi|juara cerdas cermat|hadiah lomba fotografi|hadiah lomba debat|juara 2|juara 3|hadiah e-sport|hadiah turnamen|juara kompetisi coding|bonus atlet|karyawan teladan|hadiah best employee|hadiah kuis|uang pembinaan atlet|hadiah juara futsal|hadiah juara badminton|beasiswa prestasi|hibah penelitian|hibah UMKM|hadiah lomba menulis|hadiah lomba video|hadiah juara catur",
  "panitia|kampus|sekolah|Kemendikbud|sponsor|perusahaan|komunitas|dinas pemuda dan olahraga|yayasan|LPDP|penyelenggara|Bank Indonesia",
  100000, 100000000, "")
R(P, "Poin Loyalitas & Voucher",
  "poin dikonversi jadi uang|voucher belanja|voucher cashback|poin MyTelkomsel|poin Alfamart|poin Indomaret|poin Tokopedia|Shopee Coins|koin Shopee dicairkan|GoPay Coins|poin LinkAja|voucher diskon|voucher gratis ongkir|poin Starbucks|voucher hotel|poin Traveloka|voucher makan|voucher Sodexo|voucher kantor|voucher undian|poin kartu member|poin Hypermart|poin Sociolla|poin bioskop|voucher ulang tahun|e-voucher|voucher Gojek|voucher Grab|voucher dari bank|poin MyPertamina",
  "Indomaret|Alfamart|Shopee|Tokopedia|Traveloka|MyTelkomsel|Starbucks|Hypermart|Grab|Gojek|Sodexo|bank|Pertamina|Sociolla",
  5000, 2000000, "")

# ======================= INCOME: PEMASUKAN LAINNYA =======================
P = "Pemasukan Lainnya"
R(P, "Pekerjaan Sampingan / Freelance",
  "freelance|kerja sampingan|proyek freelance|honor freelance|side job|kerjaan lepas|fee ngajar privat|honor ngajar les|honor MC|honor narasumber|fee jadi pembicara|honor translate|jasa terjemahan|honor menulis|fee talent|fee jadi model|fee extras film|honor survei|ngojek|part time akhir pekan|job dadakan|freelance event|fee admin media sosial|jasa input data|jasa ketik|honor jaga stand|fee SPG|honor tutor|fee ngajar online|bayaran jadi juri|jastip|honor moderator|honor transkrip",
  "klien|EO|agency|Sribulancer|Fastwork|Upwork|Projects.co.id|Fiverr|teman|kantor|sekolah|panitia|bimbel|Ruangguru|Glints",
  50000, 20000000, "")
R(P, "Pengembalian Dana / Refund",
  "refund tiket|pengembalian dana|refund Shopee|refund Tokopedia|refund pesanan dibatalkan|refund tiket pesawat|refund tiket kereta|refund hotel|refund Traveloka|dana kembali|pengembalian ongkir|pengembalian deposit kos|deposit kembali|uang muka dikembalikan|refund Gojek|refund Grab|refund pembayaran ganda|restitusi pajak|SPT lebih bayar|uang jaminan kembali|refund barang retur|dana retur|refund asuransi|refund top up|refund saldo|pengembalian uang kuliah|refund tiket konser|refund voucher|refund double charge|refund pembatalan|refund biaya admin|refund kelebihan bayar|refund langganan|pengembalian deposit sewa",
  "Shopee|Tokopedia|Traveloka|tiket.com|Lazada|Gojek|Grab|Blibli|Agoda|Bukalapak|Garuda|Citilink|KAI|Zalora|DJP|kampus|pemilik kos",
  5000, 30000000, "")
R(P, "Klaim & Reimburse Kantor",
  "reimburse kantor|reimburse perjalanan dinas|reimburse bensin|reimburse makan|klaim kesehatan kantor|klaim medical|klaim rawat jalan|klaim asuransi|klaim kacamata|reimburse transport|reimburse tol|reimburse parkir|uang perjalanan dinas|uang dinas|per diem|reimburse hotel dinas|klaim asuransi kesehatan|klaim kecelakaan|reimburse meeting klien|reimburse belanja kantor|reimburse pulsa|reimburse internet|reimburse laptop|reimburse training|reimburse sertifikasi|reimburse tiket|reimburse taksi|reimburse ATK|reimburse seminar|klaim gigi|klaim persalinan|bantuan duka dari kantor|reimburse dinas luar kota",
  "kantor|HRD|finance|bagian keuangan|AXA|Allianz|Prudential|Manulife|BPJS|asuransi|Cigna|kantor pusat|Mandiri Inhealth|Admedika",
  20000, 25000000, "")
R(P, "Penjualan Barang Bekas",
  "HP bekas|laptop bekas|motor bekas|mobil bekas|sepeda bekas|baju bekas|buku bekas|TV bekas|kulkas bekas|sofa bekas|kamera bekas|barang preloved|tas bekas|sepatu bekas|kasur bekas|perabot bekas|jam tangan bekas|konsol game bekas|PS4 bekas|gitar bekas|koleksi action figure|kardus bekas|besi tua|barang rongsok|botol bekas|iPhone lama|monitor lama|HP lama|stroller bekas|lemari bekas",
  "OLX|Facebook Marketplace|Carousell|Tokopedia|Shopee|Instagram|Kaskus|grup WA|teman|pembeli|tukang loak|Bukalapak|pengepul|Carsome",
  5000, 80000000, "hasil jual,laku jual,dapat dari jual,nerima uang jual")
R(P, "Pendapatan Lain-lain",
  "pemasukan lain|uang kaget|rezeki nomplok|uang tak terduga|transferan dari teman|pembayaran utang|utang dibayar teman|pinjaman dikembalikan|piutang dilunasi|dapat arisan|arisan cair|uang temuan|rezeki dadakan|menang giveaway|bantuan sosial|bantuan pemerintah|BLT|PKH|Kartu Prakerja|insentif Prakerja|bantuan UMKM|BPUM|pencairan JHT|JHT BPJS|uang pensiun|dana pensiun|santunan asuransi|bagian warisan|ganti rugi diterima|uang celengan|pecahin celengan|uang titipan|dana hibah|uang damai",
  "teman|saudara|BPJS Ketenagakerjaan|Kemensos|pemerintah|Prakerja|bank|dinas|Taspen|kantor pos|ahli waris|notaris|asuransi|rekan",
  5000, 50000000, "")

assert len(ROWS) == 79, len(ROWS)
