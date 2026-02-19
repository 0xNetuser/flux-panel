package model

type UserNode struct {
	ID     int64 `gorm:"primaryKey;autoIncrement" json:"id"`
	UserId int64 `gorm:"column:user_id;uniqueIndex:idx_user_node" json:"userId"`
	NodeId int64 `gorm:"column:node_id;uniqueIndex:idx_user_node" json:"nodeId"`
}

func (UserNode) TableName() string {
	return "user_node"
}
