export var MsgType;
(function (MsgType) {
    MsgType[MsgType["Join"] = 0] = "Join";
    MsgType[MsgType["Leave"] = 1] = "Leave";
    MsgType[MsgType["Move"] = 2] = "Move";
    MsgType[MsgType["Food"] = 3] = "Food";
    MsgType[MsgType["Death"] = 4] = "Death";
})(MsgType || (MsgType = {}));
