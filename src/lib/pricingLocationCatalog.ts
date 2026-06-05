export interface PricingLocationSelection {
  country?: string | null;
  region?: string | null;
  city?: string | null;
  district?: string | null;
}

interface PricingLocationCity {
  name: string;
  districts: string[];
}

interface PricingLocationRegion {
  name: string;
  cities: PricingLocationCity[];
}

interface PricingLocationCountry {
  name: string;
  regions: PricingLocationRegion[];
}

const GLOBAL_COUNTRY_OPTIONS = [
  'Afghanistan',
  'Albania',
  'Algeria',
  'Andorra',
  'Angola',
  'Antigua and Barbuda',
  'Argentina',
  'Armenia',
  'Australia',
  'Austria',
  'Azerbaijan',
  'Bahamas',
  'Bahrain',
  'Bangladesh',
  'Barbados',
  'Belarus',
  'Belgium',
  'Belize',
  'Benin',
  'Bhutan',
  'Bolivia',
  'Bosnia and Herzegovina',
  'Botswana',
  'Brazil',
  'Brunei',
  'Bulgaria',
  'Burkina Faso',
  'Burundi',
  'Cambodia',
  'Cameroon',
  'Canada',
  'Cape Verde',
  'Central African Republic',
  'Chad',
  'Chile',
  'China',
  'Colombia',
  'Comoros',
  'Congo',
  'Costa Rica',
  'Croatia',
  'Cuba',
  'Cyprus',
  'Czech Republic',
  'Democratic Republic of the Congo',
  'Denmark',
  'Djibouti',
  'Dominica',
  'Dominican Republic',
  'Ecuador',
  'Egypt',
  'El Salvador',
  'Equatorial Guinea',
  'Eritrea',
  'Estonia',
  'Eswatini',
  'Ethiopia',
  'Fiji',
  'Finland',
  'France',
  'Gabon',
  'Gambia',
  'Georgia',
  'Germany',
  'Ghana',
  'Greece',
  'Grenada',
  'Guatemala',
  'Guinea',
  'Guinea-Bissau',
  'Guyana',
  'Haiti',
  'Honduras',
  'Hong Kong',
  'Hungary',
  'Iceland',
  'India',
  'Indonesia',
  'Iran',
  'Iraq',
  'Ireland',
  'Israel',
  'Italy',
  'Ivory Coast',
  'Jamaica',
  'Japan',
  'Jordan',
  'Kazakhstan',
  'Kenya',
  'Kiribati',
  'Kuwait',
  'Kyrgyzstan',
  'Laos',
  'Latvia',
  'Lebanon',
  'Lesotho',
  'Liberia',
  'Libya',
  'Liechtenstein',
  'Lithuania',
  'Luxembourg',
  'Madagascar',
  'Malawi',
  'Malaysia',
  'Maldives',
  'Mali',
  'Malta',
  'Marshall Islands',
  'Mauritania',
  'Mauritius',
  'Mexico',
  'Micronesia',
  'Moldova',
  'Monaco',
  'Mongolia',
  'Montenegro',
  'Morocco',
  'Mozambique',
  'Myanmar',
  'Namibia',
  'Nauru',
  'Nepal',
  'Netherlands',
  'New Zealand',
  'Nicaragua',
  'Niger',
  'Nigeria',
  'North Korea',
  'North Macedonia',
  'Norway',
  'Oman',
  'Pakistan',
  'Palau',
  'Panama',
  'Papua New Guinea',
  'Paraguay',
  'Peru',
  'Philippines',
  'Poland',
  'Portugal',
  'Qatar',
  'Romania',
  'Russia',
  'Rwanda',
  'Saint Kitts and Nevis',
  'Saint Lucia',
  'Saint Vincent and the Grenadines',
  'Samoa',
  'San Marino',
  'Sao Tome and Principe',
  'Saudi Arabia',
  'Senegal',
  'Serbia',
  'Seychelles',
  'Sierra Leone',
  'Singapore',
  'Slovakia',
  'Slovenia',
  'Solomon Islands',
  'Somalia',
  'South Africa',
  'South Korea',
  'South Sudan',
  'Spain',
  'Sri Lanka',
  'Sudan',
  'Suriname',
  'Sweden',
  'Switzerland',
  'Syria',
  'Taiwan',
  'Tajikistan',
  'Tanzania',
  'Thailand',
  'Timor-Leste',
  'Togo',
  'Tonga',
  'Trinidad and Tobago',
  'Tunisia',
  'Turkey',
  'Turkmenistan',
  'Tuvalu',
  'Uganda',
  'Ukraine',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Uruguay',
  'Uzbekistan',
  'Vanuatu',
  'Vatican City',
  'Venezuela',
  'Vietnam',
  'Yemen',
  'Zambia',
  'Zimbabwe',
] as const;

export const PRICING_LOCATION_CATALOG: PricingLocationCountry[] = [
  {
    name: 'Philippines',
    regions: [
      {
        name: 'Metro Manila',
        cities: [
          { name: 'Manila', districts: ['Binondo', 'Ermita', 'Intramuros', 'Malate', 'Manila Bay Area', 'Sampaloc', 'Paco', 'Quiapo', 'Santa Ana', 'Tondo', 'Port Area', 'San Miguel', 'Santa Cruz', 'Sta. Mesa', 'San Andres Bukid', 'San Nicolas'] },
          { name: 'Makati', districts: ['Makati CBD', 'Poblacion', 'Rockwell Center', 'Legazpi Village', 'Salcedo Village', 'Bel-Air', 'San Lorenzo Village', 'Forbes Park', 'Dasmarinas Village', 'Urdaneta Village', 'Magallanes Village', 'Guadalupe Nuevo', 'Guadalupe Viejo'] },
          { name: 'Taguig', districts: ['Bonifacio Global City', 'McKinley Hill', 'Fort Bonifacio', 'Western Bicutan', 'Ususan', 'FTI Complex', 'Hagonoy', 'Napindan', 'Pinagsama', 'Lower Bicutan', 'Upper Bicutan', 'Wawa Taguig', 'Central Bicutan'] },
          { name: 'Pasay', districts: ['Mall of Asia Complex', 'Newport City', 'Manila Bay Area', 'Ninoy Aquino Airport Area', 'Baclaran', 'EDSA Pasay', 'Libertad', 'San Isidro Pasay', 'Malibay'] },
          { name: 'Paranaque', districts: ['Entertainment City', 'Baclaran', 'Aseana City', 'BF Homes', 'Sucat', 'Multinational Village', 'San Dionisio', 'Tambo', 'Don Galo', 'La Huerta', 'Marcelo Green'] },
          { name: 'Quezon City', districts: ['Eastwood City', 'Cubao', 'Tomas Morato', 'Commonwealth', 'Diliman', 'Novaliches', 'Fairview', 'Kamuning', 'Quezon Avenue Corridor', 'Tandang Sora', 'Balintawak', 'Project 4', 'Project 6', 'Batasan Hills', 'Payatas', 'Bagong Silangan', 'Pasong Tamo', 'Kamias'] },
          { name: 'Pasig', districts: ['Ortigas Center', 'Kapitolyo', 'Arcovia City', 'C5 Corridor', 'Caniogan', 'Ugong', 'Rosario', 'San Joaquin', 'Valle Verde', 'Pinagbuhatan', 'Manggahan'] },
          { name: 'Mandaluyong', districts: ['Greenfield District', 'Shaw Boulevard', 'Ortigas Fringe', 'Wack-Wack', 'Highway Hills', 'Addition Hills', 'Barangka', 'Buayang Bato', 'Hagdan Bato', 'Mauway', 'Plainview'] },
          { name: 'Marikina', districts: ['Concepcion', 'Tumana', 'Industrial Valley', 'Sta. Elena', 'Parang', 'Nangka', 'Calumpang', 'Sto. Nino', 'Tanong', 'Malanday', 'San Roque Marikina', 'Barangka Marikina'] },
          { name: 'Muntinlupa', districts: ['Alabang', 'Filinvest City', 'Ayala Alabang', 'Sucat', 'Cupang', 'Putatan', 'Tunasan', 'Bayanan', 'Poblacion Muntinlupa', 'Buli'] },
          { name: 'Las Pinas', districts: ['Almanza Uno', 'Almanza Dos', 'BF International', 'Pamplona Uno', 'Pamplona Dos', 'Pilar Village', 'Pulang Lupa Uno', 'Pulang Lupa Dos', 'Talon Uno', 'Talon Dos', 'Zapote', 'CAA'] },
          { name: 'Caloocan', districts: ['Monumento', 'Grace Park', 'EDSA Caloocan', 'Bagong Barrio', 'Baesa', 'Camarin', 'Deparo', 'Bagumbong', '5th Avenue', 'Sangandaan', 'Kaunlaran', 'Maypajo'] },
          { name: 'Malabon', districts: ['Longos', 'Tinajeros', 'Catmon', 'Acacia', 'Hulong Duhat', 'Panghulo', 'Tañong', 'Tugatog', 'Concepcion Malabon', 'Dampalit'] },
          { name: 'Navotas', districts: ['Navotas Fish Port', 'NBBS', 'San Jose Navotas', 'Bangus', 'Sipac-Almacen', 'Bagumbayan Norte', 'Bagumbayan Sur', 'Tangos'] },
          { name: 'Valenzuela', districts: ['Malinta', 'Karuhatan', 'Mapulang Lupa', 'Polo', 'Lawang Bato', 'Paso de Blas', 'Parada', 'Ugong', 'Canumay', 'Lingunan', 'Marulas', 'Punturin'] },
          { name: 'San Juan', districts: ['Greenhills', 'Pinaglabanan', 'Addition Hills', 'Salapan', 'Corazon de Jesus', 'Rivera', 'Batis', 'Kabayanan', 'Pasadena', 'West Crame'] },
        ],
      },
      {
        name: 'Ilocos Region',
        cities: [
          { name: 'Vigan City', districts: ['Calle Crisologo', 'Plaza Burgos', 'Mestizo District', 'Liberation Boulevard', 'Plaza Salcedo', 'Barangay I', 'Barangay II', 'Barangay III', 'Barangay IV', 'Tamag', 'Ayusan Norte', 'Ayusan Sur'] },
          { name: 'Laoag City', districts: ['Laoag City Proper', 'San Nicolas', 'Balatong', 'Lagui-Sail', 'Natividad', 'San Lorenzo', 'San Basilio', 'Zamboanga', 'Gabu Norte', 'Gabu Sur', 'Cavit'] },
          { name: 'San Fernando City (La Union)', districts: ['Poro', 'Lingsat', 'Carlatan', 'Cadaclan', 'Pagdalagan Sur', 'Sevilla', 'Tanqui', 'Catbangen', 'Santiago Norte', 'Santiago Sur'] },
          { name: 'Dagupan City', districts: ['Mayombo', 'Perez Boulevard', 'Herrero', 'Calmay', 'Bonuan Gueset', 'Bonuan Boquig', 'Pantal', 'Tapuac', 'Bacayao Norte', 'Bacayao Sur', 'Tondaligan', 'Lucao'] },
          { name: 'Alaminos City', districts: ['Lucap', 'Hundred Islands Area', 'Poblacion Alaminos', 'Bolaney', 'Bani', 'Anda', 'Quezon', 'Tanaytay'] },
          { name: 'Urdaneta City', districts: ['Poblacion Urdaneta', 'Nancayasan', 'Anonas', 'Catablan', 'Pinmaludpod'] },
        ],
      },
      {
        name: 'Cagayan Valley',
        cities: [
          { name: 'Tuguegarao City', districts: ['Centro', 'Ugac Norte', 'Annafunan', 'Capatan', 'Caggay', 'Cataggaman Nuevo', 'Cataggaman Viejo', 'Leonarda', 'Pengue-Ruyu', 'Tanza', 'Ugac Sur'] },
          { name: 'Cauayan City', districts: ['Rizal', 'Poblacion Cauayan', 'Cabaruan', 'District I', 'Caggay', 'Minante I', 'Minante II', 'San Fermin', 'Turayong', 'Villa Concepcion'] },
          { name: 'Ilagan City', districts: ['Alibagu', 'Fugo', 'Naguilian', 'Dammang East', 'Calamagui East', 'Delfin Albano', 'Barangay 1', 'San Felipe', 'Malitao', 'San Juan Ilagan'] },
          { name: 'Santiago City', districts: ['Dubinan East', 'Dubinan West', 'Sinabbaran', 'Balintocatoc', 'Poblacion Santiago', 'Malvar'] },
        ],
      },
      {
        name: 'Central Luzon',
        cities: [
          { name: 'Angeles City', districts: ['Clark Freeport Zone', 'Balibago', 'Marisol', 'Pampang', 'Lourdes Sur', 'Amsic', 'Pulung Maragul', 'Malabanias', 'Agapito del Rosario', 'Cutcut', 'Lourdes Norte', 'Ninoy Aquino'] },
          { name: 'San Fernando City (Pampanga)', districts: ['City Proper', 'Dolores', 'Sindalan', 'Del Pilar', 'San Agustin', 'Santo Rosario', 'Quebiawan', 'San Isidro San Fernando', 'Maimpis', 'Calulut'] },
          { name: 'Olongapo City', districts: ['New Kalalake', 'Gordon Heights', 'Subic Bay Area', 'Barretto', 'East Bajac-Bajac', 'West Tapinac', 'New Ilalim', 'Sta. Rita Olongapo', 'Kalaklan', 'Mabayuan'] },
          { name: 'Mabalacat City', districts: ['Dau', 'Sapangbato', 'Atlu-Bola', 'Poblacion Mabalacat', 'Sto. Domingo', 'Camachiles', 'Dolores Mabalacat', 'Dapdap', 'Paralayunan'] },
          { name: 'Tarlac City', districts: ['San Vicente', 'San Sebastian', 'Tibag', 'Sapang Maragul', 'Santo Cristo', 'Balingcanaway', 'San Isidro Tarlac', 'Matatalaib', 'Sta. Maria Tarlac', 'Sto. Nino Tarlac'] },
          { name: 'Cabanatuan City', districts: ['Sta. Isabel', 'Paco Roman', 'Zulueta', 'Valle', 'Magsaysay', 'Kalikid Norte', 'Aduas Norte', 'Aduas Centro', 'Sumacab Norte', 'Bitas'] },
          { name: 'Malolos City', districts: ['Catmon', 'Caingin', 'Sto. Nino Malolos', 'Sumapang Matanda', 'Bulihan', 'Calero', 'Longos', 'Anilao', 'Atlag', 'Babatnin', 'Bagna', 'Cofradia'] },
          { name: 'San Jose del Monte City', districts: ['Poblacion San Jose del Monte', 'Minuyan', 'Tungkong Mangga', 'Muzon', 'Paradise III', 'Graceville'] },
          { name: 'Meycauayan City', districts: ['Malhacan', 'Lawa', 'Pantoc', 'Bayugo', 'Banga Meycauayan'] },
        ],
      },
      {
        name: 'CALABARZON',
        cities: [
          { name: 'Antipolo City', districts: ['Mayamot', 'Dela Paz', 'San Roque Antipolo', 'Mambugan', 'Bagong Nayon', 'Inarawan', 'Dalig', 'San Jose Antipolo', 'San Luis Antipolo', 'Cupang Antipolo'] },
          { name: 'Batangas City', districts: ['Poblacion Batangas', 'Kumintang Ibaba', 'Cuta', 'Sta. Rita Karsada', 'Alangilan', 'Balagtas', 'Pallocan West', 'Pallocan East', 'Kumintang Ilaya', 'Bolbok', 'San Isidro Batangas'] },
          { name: 'Calamba City', districts: ['Real', 'Pansol', 'Crossing Calamba', 'Majada Out', 'Parian', 'Barandal', 'Canlubang', 'Halang', 'Turbina', 'Laguerta', 'Banlic'] },
          { name: 'Lipa City', districts: ['Marawoy', 'Mataas na Lupa', 'San Guillermo', 'Tambo', 'Tibig', 'Pinagkawitan', 'Marauoy', 'Antipolo del Norte', 'Antipolo del Sur', 'Bulacnin', 'Dagatan', 'Inosloban'] },
          { name: 'Lucena City', districts: ['Ilayang Dupay', 'Ibabang Dupay', 'Market Area Lucena', 'Dalahican', 'Barra', 'Bocohan', 'Cotta', 'Gulang-Gulang', 'Isabang', 'Mayao Kanluran', 'Mayao Silangan', 'Talao-Talao'] },
          { name: 'Tagaytay', districts: ['Tagaytay Highlands', 'Kaybagal North', 'Kaybagal South', 'Mahogany Market Area', 'Silang Junction', 'Sungay East', 'Sungay West', 'Patutong Malaki North', 'Patutong Malaki South'] },
          { name: 'Sta. Rosa City', districts: ['Balibago', 'Tagapo', 'Macabling', 'Pulong Sta. Cruz', 'Dila', 'Casile', 'Kanluran', 'Aplaya Sta. Rosa', 'Labas', 'Malusak', 'Pooc'] },
          { name: 'Bacoor City', districts: ['Molino I', 'Molino II', 'Molino III', 'Habay I', 'Habay II', 'Talaba I', 'Talaba II', 'Banalo', 'Dulong Bayan', 'Niog I', 'Niog II', 'Soldiers Hills'] },
          { name: 'Imus City', districts: ['Bucandala I', 'Bucandala II', 'Tanzang Luma', 'Alapan I', 'Alapan II', 'Buhay na Tubig', 'Malagasang I', 'Malagasang II', 'Toclong I', 'Toclong II', 'Pasong Buaya'] },
        ],
      },
      {
        name: 'Mimaropa',
        cities: [
          { name: 'Puerto Princesa City', districts: ['San Pedro', 'Bancao-Bancao', 'Sta. Monica', 'Tiniguiban', 'Sicsican', 'San Jose Puerto Princesa', 'Irawan', 'Tagburos', 'Mandaragat', 'Manggahan Puerto Princesa', 'Babuyan', 'Bacungan'] },
          { name: 'El Nido', districts: ['Corong Corong', 'Lio Tourism Estate', 'Town Proper El Nido', 'Nacpan', 'Marimegmeg', 'Maligaya', 'Sibaltan', 'Pasadeña El Nido', 'New Ibajay'] },
          { name: 'Coron', districts: ['Coron Town Proper', 'Busuanga Gateway', 'San Nicolas Coron', 'Barangay 1 Coron', 'Barangay 2 Coron', 'Decabocan', 'Malawig'] },
          { name: 'Calapan City', districts: ['Camilmil', 'Canubing Norte', 'Canubing Sur', 'Ilaya', 'Pachoca', 'Bayanan I', 'Bayanan II', 'Guinobatan', 'Balite', 'Lalud'] },
          { name: 'Romblon', districts: ['Poblacion Romblon', 'Lonos', 'Agnipa', 'Cajidiocan', 'Odiongan', 'San Andres Romblon', 'Looc Romblon'] },
        ],
      },
      {
        name: 'Bicol Region',
        cities: [
          { name: 'Legazpi City', districts: ['Embarcadero', 'Sagpon', 'Pinaric', 'Old Albay District', 'Kawit', 'Bigaa', 'Imperial Court', 'Banquerohan', 'Bagong Abre', 'Bañadero', 'Buyuan'] },
          { name: 'Naga City', districts: ['Penaranda', 'Triangulo', 'Concepcion Pequeña', 'Igualdad Interior', 'Dinaga', 'Tinago Naga', 'Pacol', 'Bagumbayan Sur', 'Bagumbayan Norte', 'Caceres', 'Calauag Naga', 'Santa Cruz Naga'] },
          { name: 'Sorsogon City', districts: ['Pangpang', 'Poblacion Sorsogon', 'Balogo', 'Bibincahan', 'Bacon', 'Buhatan', 'Cambulaga', 'Cabid-an', 'Bon-ot', 'Almendras-Cogon'] },
          { name: 'Iriga City', districts: ['San Nicolas Iriga', 'Sta. Cruz Iriga', 'Sagrada', 'Antipolo Iriga', 'San Francisco Iriga', 'Sta. Elena Iriga', 'San Roque Iriga', 'Tinangis', 'Doña Maria'] },
          { name: 'Tabaco City', districts: ['Poblacion Tabaco', 'San Lorenzo Tabaco', 'Barangay 1 Tabaco', 'Barangay 2 Tabaco', 'Tayhi'] },
        ],
      },
      {
        name: 'Western Visayas',
        cities: [
          { name: 'Iloilo City', districts: ['Iloilo Business Park', 'Mandurriao', 'Smallville', 'Molo', 'Jaro', 'La Paz Iloilo', 'Lapuz', 'City Proper', 'Arevalo', 'Tanza', 'Oton Area', 'Diversion Road'] },
          { name: 'Bacolod City', districts: ['Lacson Street', 'The Ruins Area', 'Goldenfields', 'Mansilingan', 'Capitol Area', 'Bata', 'Handumanan', 'Taculing', 'Villamonte', 'Tangub', 'Singcang', 'Banago', 'Reclamation Area Bacolod'] },
          { name: 'Boracay', districts: ['Station 1', 'Station 2', 'Station 3', 'Diniwid', 'Puka Beach Area', 'Bulabog', 'Cagban', 'Yapak', 'Ilig-iligan'] },
          { name: 'Roxas City', districts: ['Pueblo', 'Baybay Roxas', 'Lawaan', 'Banica', 'Culajao', 'Cogon Roxas', 'Dumolog', 'Jumaguicpic', 'Bolo'] },
          { name: 'Kabankalan City', districts: ['Poblacion Kabankalan', 'Oringao', 'Mina-utok', 'Camingawan'] },
        ],
      },
      {
        name: 'Central Visayas',
        cities: [
          { name: 'Cebu City', districts: ['Cebu IT Park', 'Cebu Business Park', 'Fuente Osmena', 'Colon Street', 'Lahug', 'Talamban', 'Mabolo', 'Carbon Market Area', 'Banilad', 'Kasambagan', 'Guadalupe Cebu', 'Basak San Nicolas', 'Apas', 'Kamputhaw', 'Labangon', 'Pardo', 'Tisa'] },
          { name: 'Lapu-Lapu City', districts: ['Mactan Island', 'Maribago', 'Punta Engano', 'Pusok', 'Pajac', 'Ibo', 'Agus', 'Mactan Export Processing Zone', 'Olango Island', 'Buaya', 'Gun-ob', 'Looc Lapu-Lapu'] },
          { name: 'Mandaue City', districts: ['North Reclamation Area', 'A.S. Fortuna', 'Tipolo', 'Centro Mandaue', 'Bakilid', 'Cambaro', 'Guizo', 'Jagobiao', 'Tabok', 'Umapad', 'Casili', 'Banilad Mandaue'] },
          { name: 'Talisay City (Cebu)', districts: ['San Isidro Talisay', 'Tangke', 'Dumlog', 'Biasong', 'Tabunok', 'Lagtang', 'Pooc Talisay', 'San Roque Talisay', 'Linao', 'Manipis', 'Maghaway'] },
          { name: 'Tagbilaran City', districts: ['Bool', 'Cogon Tagbilaran', 'Mansasa', 'Dao', 'Poblacion I', 'Poblacion II', 'Poblacion III', 'Ubujan', 'Cabawan', 'Dampas', 'Taloto'] },
          { name: 'Dumaguete City', districts: ['Poblacion Dumaguete', 'Calindagan', 'Piapi', 'Banilad Dumaguete', 'Candau-ay', 'Junob', 'Camanjac', 'Bagacay Dumaguete', 'Looc Dumaguete', 'Taclobo'] },
        ],
      },
      {
        name: 'Eastern Visayas',
        cities: [
          { name: 'Tacloban City', districts: ['Downtown Tacloban', 'San Jose Tacloban', 'Abucay', 'Marasbaras', 'Sagkahan', 'Caibaan', 'Suhi', 'Fatima Tacloban', 'Naga-naga', 'Diit', 'San Paglaom', 'Sto. Nino Tacloban'] },
          { name: 'Calbayog City', districts: ['Poblacion Calbayog', 'Oquendo', 'Tinambacan', 'Bagacay Calbayog', 'Balud', 'Hamorawon', 'Nijaga', 'Tarangnan'] },
          { name: 'Catbalogan City', districts: ['Poblacion Catbalogan', 'Sto. Nino Catbalogan', 'Albalate', 'San Andres Catbalogan', 'Mercedes', 'Munoz'] },
          { name: 'Ormoc City', districts: ['Poblacion Ormoc', 'Bantigue', 'Cogon Ormoc', 'Linao Ormoc', 'Bagong Buhay Ormoc'] },
        ],
      },
      {
        name: 'Zamboanga Peninsula',
        cities: [
          { name: 'Zamboanga City', districts: ['Canelar', 'Tetuan', 'Sta. Barbara', 'Mayor Jaldon', 'Rio Hondo', 'Putik', 'Talon-Talon', 'Mampang', 'Guiwan', 'Pasonanca', 'Calarian', 'Lunzuran', 'San Roque Zamboanga'] },
          { name: 'Pagadian City', districts: ['Poblacion Pagadian', 'Balangasan', 'Sta. Lucia', 'San Pedro Pagadian', 'Buenavista Pagadian', 'Gatas', 'Tiguma', 'San Francisco Pagadian', 'Tawagan Norte'] },
          { name: 'Dipolog City', districts: ['Sicayab', 'Turno', 'Dicle', 'Minaog', 'Potol', 'Cogon Dipolog', 'Sta. Isabel Dipolog', 'Biasong Dipolog', 'Sunset Boulevard Dipolog'] },
          { name: 'Isabela City (Basilan)', districts: ['Port Area Isabela', 'Aguada', 'Sunrise Village', 'Kumalarang', 'Calvario', 'Barangay 4 Isabela', 'Sta. Barbara Isabela'] },
        ],
      },
      {
        name: 'Northern Mindanao',
        cities: [
          { name: 'Cagayan de Oro City', districts: ['Divisoria CDO', 'Lapasan', 'Gusa', 'Pueblo', 'Carmen CDO', 'Limketkai Area', 'Macasandig', 'Bulua', 'Kauswagan', 'Bugo', 'Nazareth', 'Balubal', 'Indahag', 'Iponan', 'Consolacion CDO', 'Lumbia'] },
          { name: 'Iligan City', districts: ['Poblacion Iligan', 'Palao', 'Bonbonon', 'Tibanga', 'Tubod', 'Tambacan', 'Digkilaan', 'Dalipuga', 'Santiago Iligan', 'Pala-o', 'Hinaplanon'] },
          { name: 'Ozamiz City', districts: ['Lam-an', 'Baybay Ozamiz', 'Malaubang', 'Poblacion Ozamiz', 'Tinago Ozamiz', 'Triunfo', 'Catadman-Manabay', 'Carangan', 'Cogon Ozamiz'] },
          { name: 'Malaybalay City', districts: ['Casisang', 'Managok', 'Aglayan', 'Poblacion Malaybalay', 'Capitan Angel', 'Dalwangan', 'Patpat', 'Kulaman', 'Linabo', 'Busdi'] },
          { name: 'Valencia City', districts: ['Poblacion Valencia', 'Bagontaas', 'Guinoyoran', 'Lumbayao', 'Tongantongan'] },
        ],
      },
      {
        name: 'Davao Region',
        cities: [
          { name: 'Davao City', districts: ['Poblacion District', 'Lanang', 'Matina', 'Buhangin', 'Agdao', 'Toril', 'Catalunan Grande', 'Talomo', 'Tibungco', 'Calinan', 'Sasa', 'Maa', 'Mintal', 'Paquibato', 'Tugbok', 'Bunawan Davao', 'Cabantian', 'Lasang'] },
          { name: 'Tagum City', districts: ['Apokon', 'Magugpo East', 'Magugpo North', 'La Filipina', 'Visayan Village', 'San Agustin Tagum', 'Cuambogan', 'Liboganon', 'Nueva Fuerza', 'Pagsabangan'] },
          { name: 'Panabo City', districts: ['J.P. Laurel Panabo', 'New Visayas', 'Kasilak', 'Gredu', 'Mabunao', 'San Francisco Panabo', 'San Pedro Panabo', 'Cagangohan', 'Nanyo', 'Little Panay'] },
          { name: 'Digos City', districts: ['Aplaya', 'Colorado', 'Dulangan', 'Ruparan', 'Kapatagan Digos', 'Tres de Mayo', 'Zone I Digos', 'Mahayag', 'Soong'] },
          { name: 'Mati City', districts: ['Pujada Bay Area', 'Don Enrique Lopez', 'Badas', 'Libudon', 'Matiao', 'Central Mati', 'Mayo', 'Sainz', 'Taguibo Mati'] },
        ],
      },
      {
        name: 'SOCCSKSARGEN',
        cities: [
          { name: 'General Santos City', districts: ['Lagao', 'Dadiangas North', 'Labangal', 'Bula GenSan', 'Fatima GenSan', 'Calumpang', 'Tambler', 'Apopong', 'City Heights', 'Siguel', 'Dadiangas South', 'Dadiangas West', 'Dadiangas East'] },
          { name: 'Koronadal City', districts: ['Zone I Koronadal', 'Assumption', 'Carpenter Hill', 'Topland', 'Mambucal', 'Saravia', 'Paraiso', 'Zone II Koronadal', 'Cacub', 'Esperanza Koronadal'] },
          { name: 'Kidapawan City', districts: ['Poblacion Kidapawan', 'Amas', 'Indangan', 'Ilomavis', 'Lanao Kidapawan', 'Sudapin', 'Singao', 'Gayanga', 'Linangkob', 'Marbel Kidapawan'] },
          { name: 'Cotabato City', districts: ['Notre Dame Area', 'Rosary Heights I', 'Rosary Heights II', 'Rosary Heights III', 'Rosary Heights IV', 'Poblacion Cotabato', 'Kalanganan I', 'Kalanganan II', 'Bagua I', 'Bagua II', 'Tamontaka', 'Awang'] },
          { name: 'Tacurong City', districts: ['New Isabela', 'New Lagao Tacurong', 'Poblacion Tacurong', 'San Emmanuel', 'Buenaflor', 'Bagontapay', 'Lawili', 'P. Labio'] },
        ],
      },
      {
        name: 'Caraga',
        cities: [
          { name: 'Butuan City', districts: ['Libertad Butuan', 'Montilla', 'Doongan', 'Ambago', 'Downtown Butuan', 'Amparo', 'Baan KM 3', 'Taguibo', 'Bancasi', 'Antongalon', 'Imadejas', 'Tiniwisan', 'Lumbocan'] },
          { name: 'Surigao City', districts: ['Washington Surigao', 'Rizal Surigao', 'Taft Surigao', 'San Juan Surigao', 'Lunao', 'Osmena Surigao', 'Cagniog', 'Libuak', 'Baybay Surigao', 'Poctoy'] },
          { name: 'Bislig City', districts: ['Mangagoy', 'Pamanlinan', 'San Antonio Bislig', 'Cumawas', 'Poblacion Bislig', 'San Fernando Bislig', 'Somil'] },
          { name: 'Siargao', districts: ['General Luna', 'Cloud 9', 'Tourism Road', 'Union Siargao', 'Dapa', 'Santa Fe Siargao', 'Burgos Siargao', 'Pilar Siargao', 'Del Carmen Siargao'] },
          { name: 'Tandag City', districts: ['Awasian', 'Telaje', 'Poblacion Tandag', 'Mabua', 'Santiago Tandag', 'Dagocdoc', 'Salvacion Tandag', 'Pandanon'] },
        ],
      },
      {
        name: 'Bangsamoro',
        cities: [
          { name: 'Marawi City', districts: ['Poblacion Marawi', 'Rapasun', 'Raya Madamba', 'Amito Marantao', 'Banggolo', 'Banga Maranao', 'Daguduban', 'Lumbac Marawi', 'Saber', 'Tuca Marawi'] },
          { name: 'Lamitan City', districts: ['Poblacion Lamitan', 'Arco', 'Lahi', 'Tuburan Lamitan', 'Tabuk Basilan', 'Ulitan', 'Suligan'] },
          { name: 'Isabela City (Basilan)', districts: ['Port Area Isabela', 'Aguada', 'Sunrise Village', 'Kumalarang', 'Calvario', 'Barangay 4 Isabela', 'Sta. Barbara Isabela'] },
          { name: 'Cotabato City', districts: ['Notre Dame Area', 'Rosary Heights I', 'Rosary Heights II', 'Rosary Heights III', 'Rosary Heights IV', 'Poblacion Cotabato', 'Kalanganan I', 'Kalanganan II', 'Bagua I', 'Bagua II', 'Tamontaka', 'Awang'] },
        ],
      },
      {
        name: 'Cordillera Administrative Region',
        cities: [
          { name: 'Baguio City', districts: ['Session Road', 'Camp John Hay', 'Outlook Drive', 'Burnham Park Area', 'Mines View', 'SM Baguio Area', 'Market Area Baguio', 'Teachers Camp Area', 'Dominican Hill', 'Magsaysay', 'Trancoville', 'Legarda Road', 'Military Cut-off', 'Upper QM', 'Hillside Baguio', 'Scout Barrio'] },
          { name: 'Tabuk City', districts: ['Bulanao', 'Dagupan Tabuk', 'Poblacion Tabuk', 'Bulanao Norte', 'Lucog', 'Cudal', 'Naneng', 'Calaccad', 'Magsaysay Tabuk'] },
          { name: 'La Trinidad', districts: ['Poblacion La Trinidad', 'Betag', 'Pico', 'Shilan', 'Wangal', 'Balili', 'Bahong'] },
        ],
      },
    ],
  },
  {
    name: 'Singapore',
    regions: [
      {
        name: 'Central Region',
        cities: [
          { name: 'Singapore', districts: ['Marina Bay', 'Orchard Road', 'Clarke Quay', 'Sentosa'] },
        ],
      },
    ],
  },
  {
    name: 'Thailand',
    regions: [
      {
        name: 'Bangkok Metropolitan Region',
        cities: [
          { name: 'Bangkok', districts: ['Sukhumvit', 'Silom', 'Siam', 'Riverside'] },
        ],
      },
    ],
  },
  {
    name: 'Japan',
    regions: [
      {
        name: 'Tokyo Metropolis',
        cities: [
          { name: 'Tokyo', districts: ['Shinjuku', 'Shibuya', 'Ginza', 'Asakusa'] },
        ],
      },
    ],
  },
  {
    name: 'United Arab Emirates',
    regions: [
      {
        name: 'Dubai Emirate',
        cities: [
          { name: 'Dubai', districts: ['Downtown Dubai', 'Dubai Marina', 'Palm Jumeirah', 'Business Bay'] },
        ],
      },
    ],
  },
  {
    name: 'United States',
    regions: [
      {
        name: 'New York',
        cities: [
          { name: 'New York City', districts: ['Manhattan', 'Brooklyn', 'Queens', 'SoHo', 'Midtown'] },
        ],
      },
      {
        name: 'California',
        cities: [
          { name: 'Los Angeles', districts: ['Downtown LA', 'Hollywood', 'Santa Monica', 'Beverly Hills'] },
          { name: 'San Francisco', districts: ['SoMa', 'Union Square', 'Mission District', 'Fishermans Wharf'] },
        ],
      },
      {
        name: 'Nevada',
        cities: [
          { name: 'Las Vegas', districts: ['The Strip', 'Downtown Las Vegas', 'Summerlin'] },
        ],
      },
      {
        name: 'Florida',
        cities: [
          { name: 'Miami', districts: ['Brickell', 'South Beach', 'Downtown Miami', 'Wynwood'] },
          { name: 'Orlando', districts: ['International Drive', 'Lake Buena Vista', 'Downtown Orlando'] },
        ],
      },
    ],
  },
  {
    name: 'United Kingdom',
    regions: [
      {
        name: 'England',
        cities: [
          { name: 'London', districts: ['Westminster', 'Soho', 'Canary Wharf', 'Kensington', 'Shoreditch'] },
          { name: 'Manchester', districts: ['City Centre', 'Spinningfields', 'Northern Quarter'] },
        ],
      },
      {
        name: 'Scotland',
        cities: [
          { name: 'Edinburgh', districts: ['Old Town', 'New Town', 'Leith'] },
        ],
      },
    ],
  },
  {
    name: 'Australia',
    regions: [
      {
        name: 'New South Wales',
        cities: [
          { name: 'Sydney', districts: ['Sydney CBD', 'Darling Harbour', 'Bondi', 'Parramatta'] },
        ],
      },
      {
        name: 'Victoria',
        cities: [
          { name: 'Melbourne', districts: ['Melbourne CBD', 'Southbank', 'Docklands', 'St Kilda'] },
        ],
      },
      {
        name: 'Queensland',
        cities: [
          { name: 'Brisbane', districts: ['Brisbane CBD', 'South Bank', 'Fortitude Valley'] },
        ],
      },
    ],
  },
  {
    name: 'Canada',
    regions: [
      {
        name: 'Ontario',
        cities: [
          { name: 'Toronto', districts: ['Downtown Toronto', 'North York', 'Scarborough', 'Yorkville'] },
        ],
      },
      {
        name: 'British Columbia',
        cities: [
          { name: 'Vancouver', districts: ['Downtown Vancouver', 'Yaletown', 'Kitsilano', 'Richmond'] },
        ],
      },
      {
        name: 'Quebec',
        cities: [
          { name: 'Montreal', districts: ['Old Montreal', 'Downtown Montreal', 'Plateau Mont-Royal'] },
        ],
      },
    ],
  },
  {
    name: 'Malaysia',
    regions: [
      {
        name: 'Kuala Lumpur',
        cities: [
          { name: 'Kuala Lumpur', districts: ['Bukit Bintang', 'KLCC', 'Chinatown', 'Mont Kiara'] },
        ],
      },
      {
        name: 'Penang',
        cities: [
          { name: 'George Town', districts: ['UNESCO Core Zone', 'Gurney Drive', 'Tanjung Tokong'] },
        ],
      },
    ],
  },
  {
    name: 'Indonesia',
    regions: [
      {
        name: 'DKI Jakarta',
        cities: [
          { name: 'Jakarta', districts: ['Central Jakarta', 'South Jakarta', 'Pantai Indah Kapuk', 'Kemang'] },
        ],
      },
      {
        name: 'Bali',
        cities: [
          { name: 'Denpasar', districts: ['Sanur', 'Renon'] },
          { name: 'Badung', districts: ['Seminyak', 'Canggu', 'Uluwatu', 'Nusa Dua'] },
        ],
      },
    ],
  },
  {
    name: 'Vietnam',
    regions: [
      {
        name: 'Ho Chi Minh City Municipality',
        cities: [
          { name: 'Ho Chi Minh City', districts: ['District 1', 'District 2', 'District 3', 'Phu Nhuan'] },
        ],
      },
      {
        name: 'Hanoi Municipality',
        cities: [
          { name: 'Hanoi', districts: ['Hoan Kiem', 'Ba Dinh', 'Tay Ho'] },
        ],
      },
      {
        name: 'Da Nang Municipality',
        cities: [
          { name: 'Da Nang', districts: ['Hai Chau', 'Son Tra', 'Ngu Hanh Son'] },
        ],
      },
    ],
  },
  {
    name: 'South Korea',
    regions: [
      {
        name: 'Seoul Capital Area',
        cities: [
          { name: 'Seoul', districts: ['Gangnam', 'Myeong-dong', 'Hongdae', 'Itaewon'] },
          { name: 'Incheon', districts: ['Songdo', 'Bupyeong'] },
        ],
      },
    ],
  },
  {
    name: 'Taiwan',
    regions: [
      {
        name: 'Northern Taiwan',
        cities: [
          { name: 'Taipei', districts: ['Xinyi', 'Daan', 'Zhongshan', 'Wanhua'] },
          { name: 'New Taipei', districts: ['Banqiao', 'Tamsui', 'Xindian'] },
        ],
      },
    ],
  },
  {
    name: 'Hong Kong',
    regions: [
      {
        name: 'Hong Kong SAR',
        cities: [
          { name: 'Hong Kong', districts: ['Central', 'Tsim Sha Tsui', 'Causeway Bay', 'Wan Chai'] },
        ],
      },
    ],
  },
  {
    name: 'Saudi Arabia',
    regions: [
      {
        name: 'Riyadh Province',
        cities: [
          { name: 'Riyadh', districts: ['Olaya', 'Al Malqa', 'King Abdullah Financial District'] },
        ],
      },
      {
        name: 'Makkah Province',
        cities: [
          { name: 'Jeddah', districts: ['Al Balad', 'Corniche', 'Al Rawdah'] },
        ],
      },
    ],
  },
  {
    name: 'Qatar',
    regions: [
      {
        name: 'Doha Municipality',
        cities: [
          { name: 'Doha', districts: ['West Bay', 'The Pearl', 'Msheireb', 'Souq Waqif'] },
        ],
      },
    ],
  },
];

function normalizeLocationValue(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => (value || '').trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function findCountry(country?: string | null) {
  const normalizedCountry = normalizeLocationValue(country);
  return PRICING_LOCATION_CATALOG.find((entry) => normalizeLocationValue(entry.name) === normalizedCountry) || null;
}

function findRegion(country?: string | null, region?: string | null) {
  const countryEntry = findCountry(country);
  const normalizedRegion = normalizeLocationValue(region);

  if (!countryEntry || !normalizedRegion) {
    return null;
  }

  return countryEntry.regions.find((entry) => normalizeLocationValue(entry.name) === normalizedRegion) || null;
}

function findCity(country?: string | null, region?: string | null, city?: string | null) {
  const regionEntry = findRegion(country, region);
  const normalizedCity = normalizeLocationValue(city);

  if (!regionEntry || !normalizedCity) {
    return null;
  }

  return regionEntry.cities.find((entry) => normalizeLocationValue(entry.name) === normalizedCity) || null;
}

export function getPricingCountryOptions(extraCountries: Array<string | null | undefined> = []): string[] {
  return uniqueSorted([
    ...GLOBAL_COUNTRY_OPTIONS,
    ...PRICING_LOCATION_CATALOG.map((country) => country.name),
    ...extraCountries,
  ]);
}

export function getPricingRegionOptions(
  country?: string | null,
  extraRegions: Array<string | null | undefined> = []
): string[] {
  const countryEntry = findCountry(country);

  return uniqueSorted([
    ...(countryEntry?.regions.map((region) => region.name) || []),
    ...extraRegions,
  ]);
}

export function getPricingCityOptions(
  country?: string | null,
  region?: string | null,
  extraCities: Array<string | null | undefined> = []
): string[] {
  const regionEntry = findRegion(country, region);

  return uniqueSorted([
    ...(regionEntry?.cities.map((city) => city.name) || []),
    ...extraCities,
  ]);
}

export function getPricingDistrictOptions(
  country?: string | null,
  region?: string | null,
  city?: string | null,
  extraDistricts: Array<string | null | undefined> = []
): string[] {
  const cityEntry = findCity(country, region, city);

  return uniqueSorted([
    ...(cityEntry?.districts || []),
    ...extraDistricts,
  ]);
}

export function getPricingLocationLabel(location?: PricingLocationSelection | null): string | null {
  if (!location) {
    return null;
  }

  const parts = [location.district, location.city, location.region, location.country]
    .map((value) => (value || '').trim())
    .filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : null;
}