var request = require('request-promise');

const {getWeekDayName} = require('./utils/dates')
const {getAverageTemp,getMinTemp,getMaxTemp} = require('./utils/temperatures')

const data = require('./data/city.list.json')
const config = require('./config.js')


async function searchCityName(ctx, next) {
    const str = ctx.request.query.city;
    if(!str){
        ctx.response.status=400
        ctx.body = []
    }

    const filteredData = await data
    .filter( city => {
        var pattern = str.split("").map((x)=>{
            return `(?=.*${x})`
        }).join("");    var regex = new RegExp(`${pattern}`, "g")    
        return city.name.match(regex);
    }).slice(0,60).map((city)=>( { value : city.name , id : city.id , label : city.name }))

    ctx.body = filteredData
}

async function getWeatherData(ctx,next){
    let params = {
        APPID : config.weatherApiKey,
    }
    params = Object.assign(params,ctx.request.query)

    const forecastData = await request({
        uri : 'https://api.openweathermap.org/data/2.5/forecast',
        qs: params
    },(err,resp,body)=>{
        // console.log(err,resp,body); //TODO: deal with error
        return body;
    })

    const currentData = await request({
        uri : 'https://api.openweathermap.org/data/2.5/weather',
        qs: params
    },(err,resp,body)=>{
        // console.log(err,resp,body); //TODO: deal with error
        return body;
    })

    const body = await prepareWeatherData(JSON.parse(currentData),JSON.parse(forecastData))
    ctx.body = body
}


async function prepareWeatherData(current,forecast){
    const MAX_GRAPH_POINTS = 8 // 8 * 3h = 24h

    let weatherData = {
        current : current,
        forecast : {},
        graph : []
    };

    try{
        // Get forecast for week
        await forecast.list.forEach( async (el,idx)=>{

            if(idx < MAX_GRAPH_POINTS)
                weatherData.graph.push(el)

            let date = new Date(el['dt_txt'])
            let key = `${date.getDate()}/${date.getMonth()+1}`
    
            if(!weatherData.forecast[key])
                weatherData.forecast[key] = {
                    name : getWeekDayName(date.getDay()),
                    temps : [],
                    min : null,
                    max : null,
                    avg : null
                }
                
            weatherData.forecast[key].temps.push({
                temp : el.main.temp,
                date : date
            })
            try{
                await Object.keys(weatherData.forecast).forEach(async (key)=>{
                    weatherData.forecast[key].avg = await getAverageTemp(weatherData.forecast[key].temps);
                    weatherData.forecast[key].min = await getMinTemp(weatherData.forecast[key].temps);
                    weatherData.forecast[key].max = await getMaxTemp(weatherData.forecast[key].temps);
                })    
            }catch(exception){
                log.error(exception)
                return {}
            }
        })
        return weatherData;
    }catch(exception){
        console.error(exception);
        return {};
    }
    

}

module.exports = {
    searchCityName : searchCityName,
    getWeatherData : getWeatherData
}