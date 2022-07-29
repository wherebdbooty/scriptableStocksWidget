//set to true to show the widget (no auto-close)
let _debug = false

let FM=FileManager.iCloud()

//change the widget display info. can be: "price", "change", or "chart"
let _showing = "price"

//actual stock symbols go in this list
let stockList	= "PHP=X,CL=F,NG=F,EURUSD=X,GBPUSD=X,JPY=X,BTC-USD,ETH-USD,DOGE-USD,LRC-USD,XRP-USD,AAPL,GOOG,7974.T,TWTR,GME,MSFT,META,WMT,TGT,BBY,NFLX,AMZN,TSLA,T,TMUS,SBUX,^DJI,^IXIC,^GSPC"

	stockList	= stockList.split(",")

//remove =X or =F, etc. from the stock symbol (eg: JPY=X is JPY in the substitution table)
//change a symbol to a name (eg: AAPL becomes Apple). If not found, just use the symbol (AAPL)
const subTable = createSubstitutionTable()

//Use a gradient for the background
const _useGradientCellBackground = true

const _LMO	= .33	//light-mode cell color opacity
const _DMO 	= .33	//dark-mode cell color opacity
const _LMGO	= .9	//light-mode gradient opacity
const _DMGO	= .9	//dark-mode gradient opacity

//footer properties
let _footer ={"font":Font.lightRoundedSystemFont(10),"shadowRadius":1,"shadowColor":Color.lightGray(),"shadowOffset":new Point(0,0)}
with(new Date())
	_footer.text = "Stock Watchlist last updated: "+getHours()+":"+(getMinutes()<10?"0":"")+getMinutes()


//widget dimensions (width/height)
let WW	= 342
let WH	= 317 //-30 for footer info space

if(Device.isPhone()){
  //this works for iphone 6S
  WW = 322
  WH = 317
}

//calculate grid size
const GW	= Math.round(Math.sqrt(stockList.length))
const GH	= Math.ceil(Math.sqrt(stockList.length))

const CHS	= 1	//cell horizontal spacing
const CVS	= 1	//cell vertical spacing
const CP	= 0.05	//cell padding

//calculate cell size
const CW	= WW/GW-(CHS*GW)+(CP*4*GW)
const CH	= WH/GH-(CVS*GH)+(CP*4*GH)

let webview = new WebView()
await webview.loadURL("https://finance.yahoo.com/quotes/"+encodeURIComponent(stockList)+"/view/v1")
await webview.waitForLoad()

let stocks = []

if(Device.isPhone()){
	stocks = await webview.evaluateJavaScript(`
		let _list = document.querySelectorAll('fin-streamer');
		let _results=[];
		let _t={};
		for(let i=0; i<_list.length; i++){
			switch(_list[i].getAttribute("data-field")){
				case "regularMarketPrice":
					_t.price = _list[i].innerText;
				break;
				case "regularMarketChangePercent":
					_t.change = _list[i].firstChild.innerText.replace("%","");
				break;
			}
			if(_t.price && _t.change){
				_results.push(_t);
				_t={};
			}
		}
		completion(_results);`,
	true)
}
else{
	stocks = await webview.evaluateJavaScript(`
		let _list = document.querySelectorAll('td');
		let _results=[];
		let _t = {};
		for(let i=0; i<_list.length;i++){
			switch(_list[i].getAttribute("aria-label")){
		  		case "Last Price":
            		_t.price = _list[i].innerText;
          		break;
    	  		case "Change":
    				_t.change = _list[i].firstChild.innerText.replace(",","");
          		break;
    	  		case "Chg %":
		    		_t.changePct = _list[i].firstChild.innerText;
          		break;
		  		case "Day Chart":  
            		_t.chart = _list[i].firstChild.firstChild.toDataURL('image/png');
          		break;
			}
			if(_t.price && _t.change && _t.changePct && _t.chart){
				_results.push(_t)
				_t = {}
			}
		};
		completion(_results);`,
	true)
}



for(let i=0;i<stockList.length;i++){
	stocks[i].name=subTable[stockList[i].split("=")[0]]?subTable[stockList[i].split("=")[0]]:stockList[i].split("=")[0]
}

if(stocks){
	
	let widget	= new ListWidget();
	
	let body = widget.addStack()
		body.layoutVertically()
		body.centerAlignContent()
		body.spacing = 10
	
	let stockArea			= body.addStack()
		stockArea.spacing	= CHS
		stockArea.size = new Size(WW,0)

	let column				= []

	for(let i = 0; i < stocks.length; i++){
		if(!column[Math.floor(i/GH)]){
			column.push(stockArea.addStack())
			with(column[Math.floor(i/GH)]){
				topAlignContent()
				layoutVertically()
				spacing = CVS
			}
		}
		
		let upDownGlyph = (["▼ ","","▲ "])[determineChange(stocks[i].change)+1]
		
		let cell = column[Math.floor(i/GH)].addStack()
		with(cell){
			layoutVertically()
			borderColor = Color.black()
			borderWidth = 1
			size = new Size(CW, CH)
			cornerRadius = (24-stocks.length)<6?6:24-stocks.length
			centerAlignContent()
			setPadding(CH*CP,CW*CP,CH*CP,CW*CP)
		}
		
		if(_useGradientCellBackground)	gradientCorrect(cell, stocks[i].change)
		else							colorCorrect(cell, stocks[i].change)
					
		let temp=cell.addStack()	//main view box / box with name & price

		with(temp){
			layoutVertically()
			size = new Size(CW*.9,CH/1.5)
			backgroundColor = Color.dynamic(Color.white(), new Color("000",.67))
			cornerRadius = (22-stocks.length)<4?4:(22-stocks.length)
			borderWidth = 1
			borderColor = Color.black()
		}
		
		let _textObj = {"price":{"text":truncateNumber(stocks[i].price,4),"font":Font.regularSystemFont(CH*2.5),"alt":"change"},
			"change":{"text":upDownGlyph+truncateNumber(stocks[i].change,4).replace(/\+|-/,""),"font":Font.regularSystemFont(CH*2.5),"alt":"price"},
			"chart":{"alt":"price"}
		}
		
		let labels=[{"text":stocks[i].name, "font":Font.regularSystemFont(CH*2)}] //list of things to show. always includes "name"
		
		if(_showing!="chart") labels.push(_textObj[_showing])
		
		for(let m = 0; m < labels.length; m++){  //print everything in labels list
			let _label=temp.addStack()
				_label.size = new Size(CW*.9,CH/3)
				_label.centerAlignContent()
				_label.setPadding(0,CW/20,0,CW/20)
							
			with(_label.addText(labels[m].text)){
				font = labels[m].font
				minimumScaleFactor = 0.01
				shadowRadius = 0.5
				shadowColor = Color.dynamic(Color.lightGray(), Color.clear())
				shadowOffset = new Point(0,1)
			}
		}
		
		if(_showing=="chart")		temp.addImage(Image.fromData(Data.fromBase64String(stocks[i].chart.split(",")[1])))
		
		cell.addSpacer(CH*.01)

		with(cell.addStack()){		//tiny box below main view box
			size = new Size(CW*.9,CH/5)
			setPadding(1,0,0,0)
			cornerRadius = (18-stocks.length)<4?4:(18-stocks.length)
			borderColor = Color.black()
			borderWidth = 1
			centerAlignContent()
			backgroundColor = Color.dynamic(Color.white(), Color.black())
  
			/*if(_isPhone){
				with(addText(_textObj[_textObj[_showing].alt].text+"%")){
					minimumScaleFactor = 0.06
					font = Font.regularRoundedSystemFont(CW*2)
				}
			}
			else{*/
				with(addText(_textObj[_textObj[_showing].alt].text+(Device.isPhone()?"%":""))){
					minimumScaleFactor = 0.06
					font = Font.regularRoundedSystemFont(CW*2)
				}  
			//}
		}
	}

	
	with(body.addStack()){	//footer
		size = new Size(WW,0)
		centerAlignContent()
		let _footerArea = addText(_footer.text)
		with(_footerArea)
			for(let i in _footer)
				_footerArea[i] = _footer[i]
	}
	
	if(_debug)		widget.presentLarge()
	else {
		Script.setWidget(widget)
		App.close()
	}
	Script.complete()

}

function createSubstitutionTable(){
	return {
		"7974.T":"Nintendo",
		"PHP":"Peso ₽",
		"CL":"Oil",
		"NG":"N. Gas",
		"EURUSD":"Euro €",
		"GBPUSD":"Pound £",
		"JPY":"Yen ¥",
		"BTC-USD":"Bitcoin",
		"ETH-USD":"Ethereum",
		"DOGE-USD":"DogeCoin",
		"LRC-USD":"Loopring",
		"XRP-USD":"Ripple",
		"TWTR":"Twitter",
		"AAPL":"Apple",
		"GOOG":"Google",
		"GME":"Gamestop",
		"XOM":"Exxon",
		"MSFT":"Microsoft",
		"WMT":"Wal-Mart",
		"F":"Ford",
		"T":"AT&T",
		"^DJI":"Dow",
		"^IXIC":"Nasdaq",
		"^GSPC":"S&P500",
		"NFLX":"Netflix",
		"AMZN":"Amazon",
		"SBUX":"Starbucks",
		"TGT":"Target",
		"TSLA":"Tesla",
		"BBY":"Best Buy",
		"TMUS":"TMobile US"
	}
}

function determineChange(_num){ //returns 1 if _num is positive , 0 if zero, or -1 if negative
	return (((parseInt(_num) || parseFloat(_num))>0) - ((parseInt(_num) || parseFloat(_num))<0))
}

function truncateNumber(_num, _precision){
	with(_num.toString())
		return substring(0,indexOf(".")+1)+substr(indexOf(".")+1, _precision)
}

function gradient(c1, c2){
	let temp = new LinearGradient()
		temp.colors = [c1,c2]
		temp.locations = [arguments[2]?arguments[2]:0, arguments[3]?arguments[3]:1.5]
	return temp
}

function colorCorrect(_obj, _num){
	let cc = {"backgroundColor":Color.dynamic(Color.lightGray(),Color.darkGray()),
			"textColor":Color.dynamic(Color.black(),Color.white())}
	
	if(_num>0)
		cc = {
			"backgroundColor":Color.dynamic(new Color("00f",_LMO), new Color("00f",_DMO)),
			"textColor":Color.dynamic(Color.black(),Color.white()),
			"shadowRadius":0, "shadowColor":Color.dynamic(Color.black(), Color.black()), "shadowOffset":new Point(0, 0.5),
			"borderColor":Color.dynamic(Color.black(), new Color("00f"))
		}
	if(_num<0)
		cc = {
			"backgroundColor":Color.dynamic(new Color("f00",_LMO), new Color("f00",_DMO)),
			"textColor":Color.dynamic(Color.black(),Color.white()),
			"shadowRadius":0, "shadowColor":Color.dynamic(Color.black(), Color.black()), "shadowOffset":new Point(0, 0.5),
			"borderColor":Color.dynamic(Color.black(), new Color("f00"))
		}
	
	for(let o in cc)	_obj[o] = cc[o]
}
	
function gradientCorrect(_obj, _num){
	if(_num==0)	_obj.backgroundGradient = gradient(
											Color.dynamic(new Color("eee",_LMGO), new Color("888",_DMGO)),
											Color.dynamic(new Color("333",_LMGO), Color.clear()))
	if(_num>0)	_obj.backgroundGradient = gradient(
											Color.dynamic(new Color("88f",_LMGO), new Color("00a",_DMGO)),
											Color.dynamic(new Color("44f",_LMGO), new Color("000",_DMGO)))
	if(_num<0)	_obj.backgroundGradient = gradient(
											Color.dynamic(new Color("f99",_LMGO), new Color("a00",_DMGO)),
											Color.dynamic(new Color("c44",_LMGO), new Color("000",_DMGO)))
}

function toggleDisplay(_forced){
	let _display = _forced?_forced:false
	
	with(FM){
		let filePath=documentsDirectory()+"/stockWidget/display.txt"

		if(!_display) //if no forced display, check the file
			if(fileExists(filePath)) {
				_display = downloadFileFromiCloud(filePath)
				_display = readString(filePath)
			}
			else	_display = "chart"
		
		switch(_display){
			case "chart":	_display = "price"; break;
			case "price":	_display = "change"; break;
			case "change":	_display = "chart"; break;
			default:		_display = "price";
		}
		writeString(filePath, _display)
	}
	return _display
}
