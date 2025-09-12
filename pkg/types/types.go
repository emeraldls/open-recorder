package types

import "github.com/pion/mediadevices/pkg/prop"

type ScreenDimension struct {
	Width  prop.IntConstraint
	Height prop.IntConstraint
}

func NewScreenDimension(width, height int64) *ScreenDimension {
	return &ScreenDimension{
		Width:  prop.Int(width),
		Height: prop.Int(height),
	}
}
