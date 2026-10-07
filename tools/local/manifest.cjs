'use strict';
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const entries = [
 ['sim','sim01','lib/scenario.js',1],['sim-02','sim02','lib/scenario.js',2],
 ['sim03','sim03','lib/scenario.js',3],['sim04','sim04','lib/meta.js',4],
 ['sim05','sim05','lib/scenario.js',5],['sim06','sim06','lib/meta.js',6],
 ['sim07','sim07','data/config.js',7],['sim08','sim08','lib/scenario.js',8],
 ['sim09','sim09','lib/scenario.js',9],['sim10','sim10','data/config.js',10],
 ['sim-plus-01','simplus01','lib/meta.js',101],['simplus02','simplus02','lib/meta.js',102]
];
module.exports = entries.map(([folder,route,file,number],i)=>{
 const source=require(path.join(root,folder,file)); const meta=source.META || source;
 return {folder,route,number,db:i+1,meta:{...meta,id:meta.id || meta.simId},entry:number>=3&&number<=9?'launch.html':'index.html'};
});
