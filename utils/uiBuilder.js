const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SectionBuilder,
    MediaGalleryBuilder, MediaGalleryItemBuilder,
    ButtonBuilder, ButtonStyle,
    ActionRowBuilder, StringSelectMenuBuilder,
    ThumbnailBuilder, FileBuilder,
    MessageFlags
} = require('discord.js');

const BRAND_URL = 'https://nyx.bot';
const BRAND_FOOTER = 'Nyx Bot';
const DEFAULT_BANNER_URL = "https://cdn.discordapp.com/attachments/1529916823150133459/1530497564665708655/F75E13D7-AC38-4B77-B9AB-DEAFCA8990E4.jpg?ex=6a65ca6e&is=6a6478ee&hm=b71a066c1e619da7ff83e82a460262845c3f50bdba638193104b5cb267729c71&";

const MONO_EMOJIS = {
    "lock": "1531752487067975963",
    "arrow_right": "1531752489034973304",
    "pin": "1531752490691854528",
    "crown": "1531752492269047992",
    "kick": "1531752493812547594",
    "kofi": "1531752495292878858",
    "paypal": "1531752496744103956",
    "unlock": "1531752498509910199",
    "arrow_left": "1531752499931779082",
    "reddit": "1531752501559296040",
    "delete": "1531752503237152858",
    "spotify": "1531752972889886791",
    "status": "1531752974857273494",
    "mail": "1531752976102850786",
    "github": "1531752978392940564",
    "website": "1531752980578041897",
    "invite": "1531752982167949412",
    "add": "1531752983568842842",
    "twitch": "1531752985472925726",
    "tiktok": "1531752988106817576",
    "cross": "1531752989663166625",
    "check": "1531752991265263676",
    "ban": "1531752993983037601",
    "warning": "1531752996768186428",
    "x_twitter": "1531753000152862820",
    "ticket": "1531753001629388820",
    "settings": "1531753003625742516",
    "announcement": "1531753005127303249",
    "shield": "1531753006708822076",
    "youtube": "1531753008483012759",
    "discord": "1531753009841836184",
    "instagram": "1531753011427282964",
    "Kickgg": "1531753039592030248",
    "link": "1542629903134883880",
    "refresh": "1542629905294950532",
    "info": "1542629911574085725",
    "sparkles": "1542629914753241135",
    "trophy": "1542629919379431525",
    "user": "1542629922525159484",
    "search": "1542629925650178118",
    "calendar": "1542629928007114792",
    "users": "1542629930108588153",
    "bell": "1542629932847337602",
    "folder": "1542629935196274750",
    "folder_x": "1542629938820022526",
    "skull": "1542629940837744730",
    "rotate_cw": "1542629943786340455",
    "fingerprint": "1542629945841287280",
    "database": "1542629948324585583",
    "plane": "1548248012923346984",
    "wand_sparkles": "1548248015825932288",
    "disc_3": "1548248018673860628",
    "paint_bucket": "1548248199989436426",
    "clapperboard": "1548248204255039543",
    "tv_minimal": "1548248209913290764",
    "dice_1": "1548248213948072028",
    "meh": "1548248220583596053",
    "images": "1548248225142677554",
    "anchor": "1548248229005623316",
    "sun_moon": "1548248234701623346",
    "cake_slice": "1548248243950059551",
    "gift": "1548248258625806426",
    "smile": "1548248267693756416",
    "flame": "1548248275919044788",
    "disc_2": "1548248279677010010",
    "music": "1548248283846283396",
    "compass": "1548248287956697158",
    "plane_takeoff": "1548248294935756831",
    "wand_2": "1548248300187287662",
    "medal": "1548248305807392918",
    "tv_2": "1548248309687128135",
    "image": "1548248313529114705",
    "cat": "1548248318285578311",
    "brush": "1548248322697863229",
    "star": "1548248326787440700",
    "film": "1548248334542704660",
    "smile_plus": "1548248340205019227",
    "pen_tool": "1548248344235610124",
    "gem": "1548248349210058772",
    "dice_6": "1548248354994257970",
    "music_4": "1548248361608683523",
    "map": "1548248367501418596",
    "coins": "1548248371750506536",
    "wallet": "1548248375818723392",
    "car": "1548248379929399327",
    "heart": "1548248383842549780",
    "gamepad": "1548248386648408127",
    "star_off": "1548248391354552352",
    "bike": "1548248395397730314",
    "ship": "1548248399323598860",
    "paw_print": "1548248403371233411",
    "droplets": "1548248407284392039",
    "dice_5": "1548248411810046002",
    "music_3": "1548248415798829107",
    "video": "1548248419653656738",
    "cloud": "1548248423646494770",
    "heart_plus": "1548248427878686792",
    "car_front": "1548248432383098880",
    "trees": "1548248437042978907",
    "map_pin": "1548248441304649788",
    "sailboat": "1548248445200900187",
    "droplet": "1548248448707592214",
    "banknote": "1548248453065474128",
    "gamepad_2": "1548248457305784430",
    "party_popper": "1548248461206487072",
    "star_half": "1548248465358716958",
    "dice_4": "1548248473009262633",
    "music_2": "1548248477123739698",
    "zap": "1548248481586618378",
    "cloud_snow": "1548248485575397426",
    "video_off": "1548248489446613032",
    "leaf": "1548248493485985812",
    "camera": "1548248497588019280",
    "tree_pine": "1548248501811417098",
    "heart_handshake": "1548248506001657937",
    "award": "1548248510007222272",
    "frown": "1548248514113445959",
    "rocket": "1548248518320193627",
    "disc": "1548248522443460641",
    "palette": "1548248526482448414",
    "dice_3": "1548248530962096148",
    "zap_off": "1548248534677987368",
    "moon": "1548248538767691796",
    "cloud_rain": "1548248543192416288",
    "umbrella": "1548248549123301468",
    "laugh": "1548248553673981982",
    "camera_off": "1548248558963007568",
    "tree_deciduous": "1548248563186667602",
    "heart_crack": "1548248567322251326",
    "annoyed": "1548248571697041478",
    "sparkle": "1548248575559991346",
    "flower": "1548248579402113040",
    "radio": "1548248584355319860",
    "disc_album": "1548248589011259434",
    "paintbrush": "1548248592840531968",
    "dice_2": "1548248596875321376",
    "wand": "1548248601434521651",
    "moon_star": "1548248606086013009",
    "cloud_lightning": "1548248610041372743",
    "tv": "1548248614210506752",
    "joystick": "1548248618589233192",
    "cake": "1548248622976602172",
    "sun": "1548248627003138069",
    "headphones": "1548248630790590484",
    "angry": "1548248634796019752",
    "snowflake": "1548248638684274819",
    "flower_2": "1548248642626781228",
    "scan_eye": "1548248646838128690",
    "file": "1548248651514519612",
    "ear": "1548248655985770586",
    "refresh_ccw": "1548248660486262924",
    "clipboard_copy": "1548248664483569697",
    "user_round_plus": "1548248668497383457",
    "bug_play": "1548248672679239744",
    "message_square_warning": "1548248676596584458",
    "list_x": "1548248681202061423",
    "history": "1548248685866123366",
    "volume_1": "1548248690064498758",
    "flag_triangle_right": "1548248693658877995",
    "scale": "1548248700021907516",
    "timer_off": "1548248704023134278",
    "alert_octagon": "1548248707919781939",
    "server_crash": "1548248712222867507",
    "file_x": "1548248716174033016",
    "ear_off": "1548248720821329941",
    "radar": "1548248724474560689",
    "user_round_minus": "1548248728962601030",
    "message_square_off": "1548248732972097616",
    "clipboard_check": "1548248736356900976",
    "bug_off": "1548248740421435454",
    "list_filter": "1548248744460558396",
    "flag_triangle_left": "1548248748499538011",
    "gavel": "1548248753104883775",
    "satellite": "1548248760675733606",
    "file_warning": "1548248764752338964",
    "terminal": "1548248768606896268",
    "mic": "1548248772620976200",
    "users_round": "1548248778409250936",
    "user_round_check": "1548248784503578634",
    "message_circle": "1548248790350299242",
    "square_terminal": "1548248799062003783",
    "list_checks": "1548248803096793088",
    "satellite_dish": "1548248807005753384",
    "file_text": "1548248811976269935",
    "search_x": "1548248816468107354",
    "flag_off": "1548248820696092682",
    "database_zap": "1548248824592465930",
    "mic_off": "1548248828405092422",
    "user_minus": "1548248834520522752",
    "calendar_x": "1548248838899245156",
    "key": "1548248843274166272",
    "message_circle_x": "1548248849921875988",
    "bell_ring": "1548248854510702602",
    "search_check": "1548248859027968130",
    "file_lock": "1548248865881464892",
    "clipboard": "1548248870465572947",
    "volume": "1548248876958482542",
    "mic_2": "1548248882213818472",
    "user_x": "1548248886701850624",
    "message_circle_warning": "1548248892037140490",
    "calendar_clock": "1548248895971262596",
    "user_cog": "1548248899985084426",
    "key_square": "1548248908814225428",
    "bell_plus": "1548248912870113280",
    "siren": "1548248916875546756",
    "folder_open": "1548248922210832415",
    "scan": "1548248926694412368",
    "filter": "1548248931400552560",
    "rotate_ccw": "1548248935850713098",
    "eye": "1548248940107927644",
    "volume_x": "1548248945417781308",
    "message_square": "1548248949549436998",
    "clipboard_x": "1548248954519429151",
    "user_round": "1548248958634037298",
    "message_circle_off": "1548248962312572963",
    "calendar_check": "1548248968796971038",
    "user_check": "1548248972974362684",
    "bell_off": "1548248976803762248",
    "key_round": "1548248980889014364",
    "server": "1548248985016209460",
    "folder_lock": "1548248989722480741",
    "scan_face": "1548248993836830730",
    "filter_x": "1548248997624422410",
    "refresh_cw": "1548249002267381770",
    "eye_off": "1548249006151311391",
    "volume_2": "1548249010911846540",
    "message_square_x": "1548249014816739418",
    "clipboard_list": "1548249018830688356",
    "user_round_x": "1548249022601498695",
    "list": "1548249026929889366",
    "bug": "1548249031929503885",
    "timer": "1548249036098633808",
    "hourglass": "1548249040129364008",
    "bell_minus": "1548249044051296286",
    "server_off": "1548249047935225856",
    "flag": "1548249051684937739",
    "vote": "1548249055631777852",
    "antenna": "1548249059720962048",
    "alarm_clock": "1548249064230092880",
    "phone_off": "1548249068151771218",
    "layers": "1548249072580689991",
    "grid_3x3": "1548249076695437312",
    "croissant": "1548249080713580638",
    "blocks": "1548249085067268106",
    "feather": "1548249089286865017",
    "martini": "1548249095171350609",
    "unlock_keyhole": "1548249099512455259",
    "lock_keyhole": "1548249103870468176",
    "bookmark": "1548249108622352434",
    "contact": "1548249112904859749",
    "plus": "1548249117258551427",
    "gauge": "1548249121184292904",
    "sunrise": "1548249126192554015",
    "sidebar": "1548249131745804358",
    "shield_plus": "1548249135872999445",
    "wind": "1548249140662898690",
    "puzzle": "1548249145490411530",
    "candy_cane": "1548249151979134977",
    "speaker": "1548249159272894534",
    "code_2": "1548249164079566929",
    "edit": "1548249168701693962",
    "toggle_right": "1548249172833214515",
    "battery_charging": "1548249178642063390",
    "inbox": "1548249185956921356",
    "circle_slash": "1548249190763855872",
    "octagon": "1548249195067080785",
    "telescope": "1548249199894724608",
    "shield_alert": "1548249204386832394",
    "hexagon": "1548249208438521908",
    "badge_minus": "1548249213861756938",
    "mouse_pointer_click": "1548249217993019452",
    "chevron_up": "1548249222569009212",
    "salad": "1548249226318975107",
    "wrench": "1548249230424940675",
    "archive": "1548249234489352272",
    "swords": "1548249238377463909",
    "chef_hat": "1548249242152472638",
    "door_closed": "1548249248326352936",
    "hand_metal": "1548249252176601119",
    "menu": "1548249256140210276",
    "quote": "1548249259931865098",
    "crosshair": "1548249263861932125",
    "waves": "1548249268303699968",
    "squirrel": "1548249273693503569",
    "box": "1548249277258530848",
    "log_out": "1548249281805160488",
    "sliders_horizontal": "1548249286255321179",
    "align_center": "1548249290353414175",
    "copy": "1548249294736326656",
    "popcorn": "1548249298662334604",
    "git_commit": "1548249302890053715",
    "users_2": "1548249306635440231",
    "focus": "1548249311173808178",
    "coffee": "1548249315624099902",
    "bold": "1548249323039629322",
    "link_2": "1548249326915158088",
    "shield_x": "1548249331352731728",
    "beer": "1548249337572884521",
    "turtle": "1548249343163891772",
    "pizza": "1548249347269857330",
    "circle": "1548249351346720839",
    "egg": "1548249355318984805",
    "infinity": "1548249359764684820",
    "panel_left": "1548249363703136326",
    "shield_check": "1548249367981457534",
    "thumbs_down": "1548249374084309082",
    "badge_x": "1548249378060242945",
    "circle_alert": "1548249382242099210",
    "drumstick": "1548249386193133628",
    "ice_cream_bowl": "1548249389980454973",
    "network": "1548249394070032414",
    "save": "1548249398872506429",
    "at_sign": "1548249402999832629",
    "tag": "1548249407051399188",
    "chevron_down": "1548249410834665663",
    "diamond": "1548249415314317412",
    "hard_drive": "1548249419168751670",
    "minus": "1548249423451267154",
    "receipt": "1548249427506896907",
    "strikethrough": "1548249431436959754",
    "wifi": "1548249435631259668",
    "align_right": "1548249439615848493",
    "calendar_heart": "1548249443877257297",
    "credit_card": "1548249450496139266",
    "grape": "1548249454837112842",
    "mail_x": "1548249461187412040",
    "power": "1548249465461407856",
    "soup": "1548249469341007885",
    "utensils": "1548249473690501212",
    "component": "1548249478073548870",
    "bookmark_check": "1548249482171252886",
    "gauge_circle": "1548249486105509953",
    "lock_keyhole_open": "1548249490622906378",
    "plug": "1548249494473277511",
    "shopping_cart": "1548249498369785856",
    "underline": "1548249502182281218",
    "bird": "1548249506808733736",
    "clock": "1548249510948634634",
    "external_link": "1548249514501087233",
    "italic": "1548249519056097381",
    "percent": "1548249523338608750",
    "shield_off": "1548249527792828429",
    "toggle_left": "1548249532939239476",
    "banana": "1548249537746051122",
    "circle_help": "1548249541885694006",
    "edit_3": "1548249546029801495",
    "id_card": "1548249550324506707",
    "octagon_x": "1548249554212888616",
    "share_2": "1548249558235086848",
    "target": "1548249563414929439",
    "badge_check": "1548249567638716419",
    "chevron_right": "1548249572227416134",
    "donut": "1548249577541345330",
    "help_circle": "1548249581521731735",
    "more_vertical": "1548249585770827816",
    "rss": "1548249590082314341",
    "sunset": "1548249596159860797",
    "wine": "1548249600001974304",
    "apple": "1548249604170981376",
    "candy": "1548249608348639324",
    "crop": "1548249616124874842",
    "hammer": "1548249620436615192",
    "maximize": "1548249625671114762",
    "pyramid": "1548249629605236807",
    "square": "1548249633854328832",
    "watch": "1548249637796839504",
    "alert_circle": "1548249642519629864",
    "box_select": "1548249646177189980",
    "cookie": "1548249650652389406",
    "git_branch": "1548249655295344681",
    "log_in": "1548249659557019699",
    "pointer": "1548249663541477401",
    "signal": "1548249668063068220",
    "upload": "1548249672278220870",
    "bluetooth": "1548249676497813516",
    "code": "1548249681023213660",
    "fish": "1548249685393809461",
    "layout_grid": "1548249689789440010",
    "phone": "1548249694080213022",
    "shield_question": "1548249698026917948",
    "triangle": "1548249702133137431",
    "battery": "1548249706550005863",
    "circle_x": "1548249710689656902",
    "egg_fried": "1548249715492266024",
    "indent": "1548249719304888422",
    "package": "1548249723893194854",
    "shield_ban": "1548249728372707399",
    "thermometer": "1548249733209001986",
    "badge_plus": "1548249737608695889",
    "chevrons_up_down": "1548249742193066085",
    "download": "1548249745980526692",
    "home": "1548249750279819334",
    "move": "1548249756667740220",
    "sandwich": "1548249762891825204",
    "table": "1548249767048642670",
    "asterisk": "1548249771163262986",
    "cherry": "1548249775533465720",
    "cup_soda": "1548249779350409350",
    "hand": "1548249783741980773",
    "minimize": "1548249800476983498",
    "rabbit": "1548249804839321611",
    "wifi_off": "1548249809201139784",
    "store": "1548249813613813801",
    "align_left": "1548249817971429476",
    "calendar_days": "1548249822325252256",
    "cpu": "1548249833528369258",
    "git_merge": "1548249838196359189",
    "mail_warning": "1548249842243993631",
    "power_off": "1548249846815785010",
    "sliders": "1548249855749787668",
    "utensils_crossed": "1548249859654549666",
    "book_lock": "1548249866441072701",
    "columns": "1548249871302131792",
    "frame": "1548249875521736764",
    "list_ordered": "1548249879795601458",
    "plug_zap": "1548249884048756746",
    "shopping_bag": "1548249888830263326",
    "type": "1548249893003464737",
    "binoculars": "1548249896807694339",
    "citrus": "1548249901098475560",
    "equal": "1548249905473126400",
    "panel_right": "1548249909176569897",
    "shield_half": "1548249913081598012",
    "thumbs_up": "1548249917045350480",
    "badge": "1548249921092591656",
    "circle_check": "1548249926108971018",
    "edit_2": "1548249930399752313",
    "ice_cream_cone": "1548249934430732298",
    "octagon_alert": "1548249938817847416",
    "send": "1548249942777270312",
    "tags": "1548249946895941652",
    "badge_alert": "1548249951044112414",
    "chevron_left": "1548249954890420234",
    "dog": "1548249959156031518",
    "hash": "1548249962968649888",
    "more_horizontal": "1548249966986919966",
    "rows": "1548249970887495731",
    "arrowleft": "1548249975065153588",
    "arrowright": "1548249979804455024",
    "house": "1548249984091160596",
    "ac": "1548249989355147264",
    "arrow": "1548249995831021588",
    "cat_ai": "1548250002185523250",
    "cat_animals": "1548250006287548456",
    "cat_antinuke": "1548250010112626770",
    "cat_automation": "1548250017280561222",
    "cat_automod": "1548250021386915940",
    "cat_feedback": "1548250029527924746",
    "cat_fun": "1548250034313756704",
    "cat_general": "1548250039896375386",
    "cat_giveaway": "1548250046204612669",
    "cat_home": "1548250050050654218",
    "cat_information": "1548250053980983296",
    "cat_join2create": "1548250057852321923",
    "cat_logging": "1548250061597708309",
    "cat_media": "1548250065997537350",
    "cat_misc": "1548250070875373569",
    "cat_moderation": "1548250074868482058",
    "cat_profiles": "1548250079209590814",
    "cat_reactionroles": "1548250083210960906",
    "cat_roleplay": "1548250087115989012",
    "cat_social": "1548250090794262621",
    "cat_tickets": "1548250094749614151",
    "cat_tracking": "1548250098973016164",
    "cat_utility": "1548250103209267220",
    "cat_vanityroles": "1548250107328200734",
    "cat_voice": "1548250111337963590",
    "cat_welcome": "1548250115674742814",
    "claim": "1548250119936147496",
    "dc": "1548250124852142110",
    "dec": "1548250128610230293",
    "disable": "1548250132942954538",
    "dnd": "1548250138680500236",
    "dots": "1548250144242278490",
    "enable": "1548250148121870386",
    "facebook": "1548250152077107200",
    "games": "1548250155940061196",
    "giveawayyes": "1548250160641867816",
    "heart4": "1548250164597366854",
    "hide": "1548250168296480818",
    "idle": "1548250172155367425",
    "inc": "1548250176773165106",
    "leftarrow": "1548250180682383421",
    "linkedin": "1548250184499208266",
    "lock1": "1548250188689444916",
    "masks": "1548250192833286175",
    "music_note": "1548250196939382855",
    "next": "1548250201347592244",
    "offline": "1548250205605068900",
    "online": "1548250209702641734",
    "pencil": "1548250214295674940",
    "people": "1548250222441013409",
    "pr_empty1": "1548250228220629022",
    "pr_progressc": "1548250232058286160",
    "pr_progressl": "1548250236391260234",
    "pr_progressr": "1548250240652410950",
    "previous": "1548250244796653678",
    "question": "1548250248881901669",
    "rightarrow": "1548250253478600754",
    "snapchat": "1548250257266319481",
    "telegram": "1548250261494173716",
    "tick": "1548250265793077349",
    "twitter": "1548250270016741448",
    "typing": "1548250274747912242",
    "unhide": "1548250278887956520",
    "unlock1": "1548250283027734528",
    "white_back": "1548250287238676520",
    "white_chart": "1548250291072274512",
    "white_cross_2": "1548250295111393330",
    "white_info": "1548250299666407424",
    "white_musicnote": "1548250303328034869",
    "white_next": "1548250307790774302",
    "white_tick_2": "1548250312375279666",
    "music_pause": "1548250317131612190",
    "music_play": "1548250328942645300",
    "music_repeat": "1548250333057130587",
    "music_shuffle": "1548250337192841287",
    "music_skip_next": "1548250341324234773",
    "music_skip_prev": "1548250345686442034",
    "music_stop": "1548250349821890572",
    "bar_l_empty": "1548250355413032991",
    "bar_l_filled": "1548250360546857060",
    "bar_m_empty": "1548250365265453066",
    "bar_m_filled": "1548250369799225494",
    "bar_r_empty": "1548250377613480006",
    "bar_r_filled": "1548250382067830794",
    "success": "1531752991265263676",
    "error": "1531752989663166625",
};

const EMOJIS = {};
for (const [name, id] of Object.entries(MONO_EMOJIS)) {
    EMOJIS[name] = `<:${name}:${id}>`;
}

const COLORS = {
    PRIMARY: 0x2B2D31,
    BRAND: 0x5865F2,
    SUCCESS: 0x57F287,
    ERROR: 0xED4245,
    WARNING: 0xFEE75C,
    LOG: 0x3498DB,
    INFO: 0x5865F2
};

function resolveColor(color) {
    if (typeof color === 'number') return color;
    if (typeof color === 'string') {
        if (color.startsWith('#')) return parseInt(color.slice(1), 16);
        return COLORS.BRAND; // default to brand for any named color if we are keeping it minimal
    }
    return COLORS.PRIMARY;
}

function buildModAPanel({ title, description, bannerUrl = DEFAULT_BANNER_URL, actionRows = [], navRow = null, showSocials = true, images = [] }) {
    const container = new ContainerBuilder();

    if (images && images.length > 0) {
        const mediaGallery = new MediaGalleryBuilder();
        for (const imgUrl of images) {
            mediaGallery.addItems(new MediaGalleryItemBuilder({ media: { url: imgUrl } }));
        }
        container.addMediaGalleryComponents(mediaGallery);
    }

    if (title) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}\n-# Nyx • Sistem Kontrol Paneli`));
    }
    
    if (navRow) {
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        container.addActionRowComponents(navRow);
    }

    if (description) {
        const descLines = description.split('\n\n');
        for (const line of descLines) {
            if (line.trim()) {
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(line.trim()));
            }
        }
    }

    if (actionRows.length > 0) {
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        for (const row of actionRows) container.addActionRowComponents(row);
    }

    if (showSocials) {
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        // Fix 3: Kompakt yatay sosyal medya link butonları ve zarif alt bilgi
        const socialRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Nyx Bot").setEmoji(MONO_EMOJIS.website).setURL(BRAND_URL),
            new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Instagram").setEmoji(MONO_EMOJIS.instagram).setURL("https://instagram.com/nyxbot"),
            new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("YouTube").setEmoji(MONO_EMOJIS.youtube).setURL("https://youtube.com/@nyxbot")
        );
        container.addActionRowComponents(socialRow);
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${BRAND_FOOTER} · Gelişmiş Discord Yönetim Altyapısı`));
    }

    return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

// YENİ STRICT KURAL: MOD B (İşlevsel/Operasyonel - Sadece Metin + Butonlar + Thumbnail)
function buildModBResponse({ title, textLines = [], fields = [], actionRows = [], files = [], images = [], thumbnail = null }) {
    const container = new ContainerBuilder();

    let mediaGallery = null;

    if (images && images.length > 0) {
        mediaGallery = new MediaGalleryBuilder();
        for (const imgUrl of images) {
            if (typeof imgUrl === 'string' && imgUrl.trim()) {
                mediaGallery.addItems(new MediaGalleryItemBuilder({ media: { url: imgUrl.trim() } }));
            }
        }
        if (mediaGallery.items.length > 0) {
            container.addMediaGalleryComponents(mediaGallery);
        }
    }

    const fullText = textLines && textLines.length > 0 ? textLines.join('\n') : '';
    // Fix 5: Temiz separator mantığı (boş parçalar elenir, ardı ardına çift separator oluşmaz)
    const sections = fullText ? fullText.split('---SEPARATOR---').map(s => s.trim()).filter(Boolean) : [];

    if (thumbnail && typeof thumbnail === 'string' && thumbnail.trim()) {
        const topSection = new SectionBuilder();
        let topContent = '';
        if (title) topContent += `### ${title}\n`;
        if (sections.length > 0) {
            topContent += sections[0];
        }
        topSection.addTextDisplayComponents(new TextDisplayBuilder().setContent(topContent.trim() || '### ' + (title || 'Bilgi')));
        topSection.setThumbnailAccessory(new ThumbnailBuilder({ media: { url: thumbnail.trim() } }));
        container.addSectionComponents(topSection);

        // Kalan bölümler arasına kontrollü tekil separator
        for (let i = 1; i < sections.length; i++) {
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(sections[i]));
        }
    } else {
        if (title) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${title}`));

        for (let i = 0; i < sections.length; i++) {
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(sections[i]));
            if (i < sections.length - 1) {
                container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            }
        }
    }

    // Fields'leri tek bir TextDisplay block olarak ekle (V2'de inline fields yok, TEK satır olarak)
    if (fields && fields.length > 0) {
        const fieldText = fields.map(f => `**${f.name}**\n${f.value}`).join('\n\n');
        if (fieldText.trim()) {
            const trimmed = fieldText.length > 3900 ? fieldText.slice(0, 3897) + '...' : fieldText;
            if (sections.length > 0 || title) {
                container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            }
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(trimmed));
        }
    }

    if (files && files.length > 0) {
        for (const f of files) {
            const fileName = f?.name || (typeof f === 'string' ? f : 'attachment.txt');
            container.addFileComponents(new FileBuilder({ file: { url: `attachment://${fileName}` } }));
        }
    }

    if (actionRows && actionRows.length > 0) {
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        for (const row of actionRows) {
            container.addActionRowComponents(row);
        }
    }

    const result = { flags: MessageFlags.IsComponentsV2, components: [container] };
    if (files && files.length > 0) {
        result.files = files;
    }
    return result;
}

// -------------------------------------------------------------
// V2 Modern Section & Checkbox/Toggle Helpers (Fix 2 & V2 Sistemleri)
// -------------------------------------------------------------

/**
 * Modern Discord V2 Settings Row (Sol text + açıklama, Sağ Button/Thumbnail Aksesuarı)
 */
function buildSettingRow({ title, description = '', button = null, thumbnail = null }) {
    const section = new SectionBuilder();
    let text = `**${title}**`;
    if (description) text += `\n-# ${description}`;
    section.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));

    if (button) {
        section.setButtonAccessory(button);
    } else if (thumbnail) {
        section.setThumbnailAccessory(typeof thumbnail === 'string' ? new ThumbnailBuilder({ media: { url: thumbnail } }) : thumbnail);
    }
    return section;
}

/**
 * Modern Discord V2 Checkbox / Toggle Switch Row (Section + Checkbox Button Accessory)
 */
function buildCheckboxRow({ id, label, description = '', isChecked = false, disabled = false }) {
    const section = new SectionBuilder();
    const statusText = isChecked ? '`[ AKTİF ]`' : '`[ DEVRE DIŞI ]`';
    const text = `${statusText} **${label}**${description ? `\n-# ${description}` : ''}`;
    section.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));

    const toggleBtn = new ButtonBuilder()
        .setCustomId(id)
        .setStyle(isChecked ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setLabel(isChecked ? 'Açık' : 'Kapalı')
        .setEmoji(isChecked ? (MONO_EMOJIS.check || MONO_EMOJIS.tick) : MONO_EMOJIS.cross)
        .setDisabled(disabled);

    section.setButtonAccessory(toggleBtn);
    return section;
}

/**
 * Modern Discord V2 Metric / Stat Kartı
 */
function buildMetricCard({ label, value, subtext = '', emojiKey = 'white_chart' }) {
    const e = MONO_EMOJIS[emojiKey] ? `<:mono:${MONO_EMOJIS[emojiKey]}> ` : '';
    let content = `${e}**${label}** › \`${value}\``;
    if (subtext) content += `\n-# ${subtext}`;
    return new TextDisplayBuilder().setContent(content);
}

/**
 * Modern Discord Ticket Oda Kontrolleri (1 Satır Primary Buton + 1 Satır Dropdown Menü)
 * Fix 1: 5 ActionRow yığınını 2 satıra indirir.
 */
function buildTicketActionComponents(channelId, isClaimed = false, isLocked = false) {
    const primaryRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`ticket_claim_${channelId}`)
            .setLabel(isClaimed ? 'Bırak' : 'Üstlen')
            .setStyle(isClaimed ? ButtonStyle.Secondary : ButtonStyle.Success)
            .setEmoji(MONO_EMOJIS.user_round_check),
        new ButtonBuilder()
            .setCustomId(`ticket_lock_${channelId}`)
            .setLabel(isLocked ? 'Kilit Aç' : 'Kilitle')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(isLocked ? MONO_EMOJIS.unlock : MONO_EMOJIS.lock),
        new ButtonBuilder()
            .setCustomId(`ticket_close_prompt_${channelId}`)
            .setLabel('Kapat')
            .setStyle(ButtonStyle.Danger)
            .setEmoji(MONO_EMOJIS.delete)
    );

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`ticket_room_actions_${channelId}`)
        .setPlaceholder('Diğer Talep İşlemleri...')
        .addOptions([
            {
                label: 'Öncelik Seviyesi',
                description: 'Talebin aciliyet derecesini değiştirin',
                value: 'priority',
                emoji: MONO_EMOJIS.flag_triangle_right
            },
            {
                label: 'Kişi Ekle',
                description: 'Talebe başka bir kullanıcı dahil edin',
                value: 'adduser',
                emoji: MONO_EMOJIS.user_round_plus
            },
            {
                label: 'Kişi Çıkar',
                description: 'Kullanıcıyı bu talepten çıkarın',
                value: 'removeuser',
                emoji: MONO_EMOJIS.user_round_minus
            },
            {
                label: 'Yeniden Adlandır',
                description: 'Oda kanal adını güncelleyin',
                value: 'rename',
                emoji: MONO_EMOJIS.file_text
            },
            {
                label: 'Yetkiliyi Dürt',
                description: 'Destek ekibine hatırlatma bildirimi gönderin',
                value: 'nudge',
                emoji: MONO_EMOJIS.bell_ring
            },
            {
                label: 'Transkript Kaydet',
                description: 'Mesaj geçmişini arşiv dosyası olarak alın',
                value: 'transcript',
                emoji: MONO_EMOJIS.clipboard_check
            }
        ]);

    const secondaryRow = new ActionRowBuilder().addComponents(selectMenu);
    return [primaryRow, secondaryRow];
}

function createContainerMessage(title, description, colorHex = null, customActionRows = [], fields = [], showBrand = false, ephemeral = false, files = []) {
    let payload;
    if (showBrand) {
        payload = buildModAPanel({ title, description, actionRows: customActionRows });
    } else {
        const textLines = description ? description.split('\n\n') : [];
        payload = buildModBResponse({ title, textLines, fields, actionRows: customActionRows, files });
    }
    
    if (ephemeral) {
        payload.flags |= MessageFlags.Ephemeral;
    }
    return payload;
}

function createV2Container({ title, description, color, fields = [], actionRows = [], images = [], showBrand = false, footer = 'Nyx Bot', thumbnail = null }) {
    const textLines = description ? description.split('\n\n') : [];
    return buildModBResponse({ title, textLines, fields, actionRows, images, color, footer, thumbnail });
}

function createV2Message({ title, description, color, fields, actionRows, showBrand = false }) {
    return createContainerMessage(title, description, color, actionRows, fields, showBrand);
}

module.exports = { 
    createV2Message, 
    createV2Container,
    createContainerMessage, 
    buildModAPanel, 
    buildModBResponse,
    buildSettingRow,
    buildCheckboxRow,
    buildMetricCard,
    buildTicketActionComponents,
    COLORS, 
    resolveColor, 
    DEFAULT_BANNER_URL,
    MONO_EMOJIS,
    EMOJIS
};
